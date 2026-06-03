import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, count, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import {
  getMetadataForJobs,
  oapiToDbStatus,
  toJobResponse,
} from "./jobs.js";

const formatJobAgent = (agent: typeof schema.jobAgent.$inferSelect) => ({
  ...agent,
  metadata: {},
});

const listJobAgents: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.jobAgent)
    .where(eq(schema.jobAgent.workspaceId, workspaceId));

  const total = countResult?.total ?? 0;

  const items = await db
    .select()
    .from(schema.jobAgent)
    .where(eq(schema.jobAgent.workspaceId, workspaceId))
    .limit(limit)
    .offset(offset);

  res.status(200).json({ items: items.map(formatJobAgent), total, limit, offset });
};

const getJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;

  const agent = await db.query.jobAgent.findFirst({
    where: and(
      eq(schema.jobAgent.id, jobAgentId),
      eq(schema.jobAgent.workspaceId, workspaceId),
    ),
  });

  if (agent == null) throw new ApiError("Job agent not found", 404);

  res.status(200).json(formatJobAgent(agent));
};

const upsertJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;
  const { body } = req;

  await db
    .insert(schema.jobAgent)
    .values({
      id: jobAgentId,
      name: body.name,
      type: body.type,
      workspaceId,
      config: body.config,
    })
    .onConflictDoUpdate({
      target: schema.jobAgent.id,
      set: {
        name: body.name,
        type: body.type,
        config: body.config,
      },
    });

  res.status(202).json({
    id: jobAgentId,
    message: "Job agent update requested",
  });
};

const deleteJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;

  const [deleted] = await db
    .delete(schema.jobAgent)
    .where(
      and(
        eq(schema.jobAgent.id, jobAgentId),
        eq(schema.jobAgent.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (deleted == null) throw new ApiError("Job agent not found", 404);

  res.status(202).json({ id: jobAgentId, message: "Job agent deleted" });
};

const assertAgentInWorkspace = async (
  workspaceId: string,
  jobAgentId: string,
) => {
  const agent = await db.query.jobAgent.findFirst({
    where: and(
      eq(schema.jobAgent.id, jobAgentId),
      eq(schema.jobAgent.workspaceId, workspaceId),
    ),
  });
  if (agent == null) throw new ApiError("Job agent not found", 404);
};

const listJobAgentJobs: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs",
  "get"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;
  const { status, includeDispatchContext } = req.query;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  await assertAgentInWorkspace(workspaceId, jobAgentId);

  const dbStatus = status != null ? oapiToDbStatus[status] : undefined;
  const where = and(
    eq(schema.job.jobAgentId, jobAgentId),
    dbStatus != null
      ? eq(schema.job.status, dbStatus as typeof schema.job.$inferSelect.status)
      : undefined,
  );

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.job)
    .where(where);
  const total = countResult?.total ?? 0;

  const rows = await db
    .select({ job: schema.job, releaseId: schema.releaseJob.releaseId })
    .from(schema.job)
    .leftJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .where(where)
    .orderBy(desc(schema.job.createdAt))
    .limit(limit)
    .offset(offset);

  const metadataMap = await getMetadataForJobs(rows.map((r) => r.job.id));

  res.status(200).json({
    items: rows.map((r) =>
      toJobResponse(
        r.job,
        r.releaseId,
        metadataMap.get(r.job.id) ?? {},
        includeDispatchContext ?? false,
      ),
    ),
    total,
    limit,
    offset,
  });
};

const claimJob: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs/{jobId}/claim",
  "post"
> = async (req, res) => {
  const { workspaceId, jobAgentId, jobId } = req.params;

  await assertAgentInWorkspace(workspaceId, jobAgentId);

  const claimed = await db
    .update(schema.job)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(
      and(
        eq(schema.job.id, jobId),
        eq(schema.job.jobAgentId, jobAgentId),
        eq(schema.job.status, "queued"),
      ),
    )
    .returning()
    .then(takeFirstOrNull);

  if (claimed == null) {
    const existing = await db
      .select({ id: schema.job.id })
      .from(schema.job)
      .where(
        and(eq(schema.job.id, jobId), eq(schema.job.jobAgentId, jobAgentId)),
      )
      .then(takeFirstOrNull);
    if (existing == null) throw new ApiError("Job not found", 404);
    throw new ApiError("Job is not available to claim", 409);
  }

  const release = await db
    .select({ releaseId: schema.releaseJob.releaseId })
    .from(schema.releaseJob)
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirstOrNull);

  const metadataMap = await getMetadataForJobs([jobId]);

  res
    .status(200)
    .json(
      toJobResponse(claimed, release?.releaseId ?? null, metadataMap.get(jobId) ?? {}),
    );
};

export const jobAgentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listJobAgents))
  .get("/:jobAgentId", asyncHandler(getJobAgent))
  .put("/:jobAgentId", asyncHandler(upsertJobAgent))
  .delete("/:jobAgentId", asyncHandler(deleteJobAgent))
  .get("/:jobAgentId/jobs", asyncHandler(listJobAgentJobs))
  .post("/:jobAgentId/jobs/:jobId/claim", asyncHandler(claimJob));
