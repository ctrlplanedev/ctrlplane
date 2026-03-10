import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

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

export const jobAgentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listJobAgents))
  .get("/:jobAgentId", asyncHandler(getJobAgent))
  .put("/:jobAgentId", asyncHandler(upsertJobAgent))
  .delete("/:jobAgentId", asyncHandler(deleteJobAgent));
