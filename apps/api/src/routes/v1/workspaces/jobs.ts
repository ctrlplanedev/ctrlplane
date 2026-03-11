import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, count, desc, eq, inArray, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueDesiredRelease } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

const dbToOapiStatus: Record<string, string> = {
  cancelled: "cancelled",
  skipped: "skipped",
  in_progress: "inProgress",
  action_required: "actionRequired",
  pending: "pending",
  failure: "failure",
  invalid_job_agent: "invalidJobAgent",
  invalid_integration: "invalidIntegration",
  external_run_not_found: "externalRunNotFound",
  successful: "successful",
};

const oapiToDbStatus: Record<string, string> = {
  cancelled: "cancelled",
  skipped: "skipped",
  inProgress: "in_progress",
  actionRequired: "action_required",
  pending: "pending",
  failure: "failure",
  invalidJobAgent: "invalid_job_agent",
  invalidIntegration: "invalid_integration",
  externalRunNotFound: "external_run_not_found",
  successful: "successful",
};

const getMetadataForJobs = async (jobIds: string[]) => {
  if (jobIds.length === 0) return new Map<string, Record<string, string>>();

  const rows = await db
    .select()
    .from(schema.jobMetadata)
    .where(inArray(schema.jobMetadata.jobId, jobIds));

  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const existing = map.get(row.jobId) ?? {};
    existing[row.key] = row.value;
    map.set(row.jobId, existing);
  }
  return map;
};

const toJobResponse = (
  j: typeof schema.job.$inferSelect,
  releaseId: string | null,
  metadata: Record<string, string>,
) => ({
  id: j.id,
  releaseId: releaseId ?? "",
  jobAgentId: j.jobAgentId ?? "",
  jobAgentConfig: j.jobAgentConfig,
  status: dbToOapiStatus[j.status] ?? j.status,
  createdAt: j.createdAt.toISOString(),
  updatedAt: j.updatedAt.toISOString(),
  metadata,
  ...(j.externalId != null && { externalId: j.externalId }),
  ...(j.message != null && { message: j.message }),
  ...(j.startedAt != null && { startedAt: j.startedAt.toISOString() }),
  ...(j.completedAt != null && { completedAt: j.completedAt.toISOString() }),
  ...(Object.keys(j.dispatchContext).length > 0 && {
    dispatchContext: j.dispatchContext,
  }),
});

const getJobs: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit: rawLimit, offset: rawOffset } = req.query;

  const limitVal = rawLimit ?? 50;
  const offsetVal = rawOffset ?? 0;

  const baseWhere = eq(schema.deployment.workspaceId, workspaceId);

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deployment.id, schema.release.deploymentId),
    )
    .where(baseWhere);

  const total = countResult?.total ?? 0;

  const rows = await db
    .select({
      job: schema.job,
      releaseId: schema.releaseJob.releaseId,
    })
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deployment.id, schema.release.deploymentId),
    )
    .where(baseWhere)
    .orderBy(desc(schema.job.createdAt))
    .limit(limitVal)
    .offset(offsetVal);

  const jobIds = rows.map((r) => r.job.id);
  const metadataMap = await getMetadataForJobs(jobIds);

  res.status(200).json({
    items: rows.map((r) =>
      toJobResponse(r.job, r.releaseId, metadataMap.get(r.job.id) ?? {}),
    ),
    total,
    offset: offsetVal,
    limit: limitVal,
  });
};

const getJob: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs/{jobId}",
  "get"
> = async (req, res) => {
  const { workspaceId, jobId } = req.params;

  const row = await db
    .select({
      job: schema.job,
      releaseId: schema.releaseJob.releaseId,
    })
    .from(schema.job)
    .leftJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .leftJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .leftJoin(
      schema.deployment,
      eq(schema.deployment.id, schema.release.deploymentId),
    )
    .where(
      and(
        eq(schema.job.id, jobId),
        eq(schema.deployment.workspaceId, workspaceId),
      ),
    )
    .then((rows) => rows[0]);

  if (row == null) throw new ApiError("Job not found", 404);

  const metadataMap = await getMetadataForJobs([jobId]);

  res
    .status(200)
    .json(toJobResponse(row.job, row.releaseId, metadataMap.get(jobId) ?? {}));
};

const getJobWithRelease: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs/{jobId}/with-release",
  "get"
> = async (req, res) => {
  const { workspaceId, jobId } = req.params;

  const row = await db
    .select({
      job: schema.job,
      releaseId: schema.releaseJob.releaseId,
      release: schema.release,
      deployment: schema.deployment,
      environment: schema.environment,
      resource: schema.resource,
    })
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deployment.id, schema.release.deploymentId),
    )
    .innerJoin(
      schema.environment,
      eq(schema.environment.id, schema.release.environmentId),
    )
    .innerJoin(
      schema.resource,
      eq(schema.resource.id, schema.release.resourceId),
    )
    .where(
      and(
        eq(schema.job.id, jobId),
        eq(schema.deployment.workspaceId, workspaceId),
      ),
    )
    .then((rows) => rows[0]);

  if (row == null) throw new ApiError("Job not found", 404);

  const metadataMap = await getMetadataForJobs([jobId]);
  const jobResponse = toJobResponse(
    row.job,
    row.releaseId,
    metadataMap.get(jobId) ?? {},
  );

  const releaseResponse = {
    id: row.release.id,
    createdAt: row.release.createdAt.toISOString(),
    releaseTarget: {
      resourceId: row.release.resourceId,
      environmentId: row.release.environmentId,
      deploymentId: row.release.deploymentId,
    },
    variables: {},
    encryptedVariables: [] as string[],
  };

  res.status(200).json({
    job: jobResponse,
    release: releaseResponse,
    environment: row.environment,
    deployment: row.deployment,
    resource: row.resource,
  });
};

const terminalStatuses = new Set([
  "cancelled",
  "skipped",
  "failure",
  "invalid_job_agent",
  "invalid_integration",
  "external_run_not_found",
  "successful",
]);

const updateJobStatus: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs/{jobId}/status",
  "put"
> = async (req, res) => {
  const { workspaceId, jobId } = req.params;
  const { body: oapiStatus } = req;

  const dbStatus = oapiToDbStatus[oapiStatus as string];
  if (dbStatus == null) throw new ApiError("Invalid job status", 400);

  const existing = await db
    .select({
      jobId: schema.job.id,
      releaseId: schema.releaseJob.releaseId,
      resourceId: schema.release.resourceId,
      environmentId: schema.release.environmentId,
      deploymentId: schema.release.deploymentId,
    })
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deployment.id, schema.release.deploymentId),
    )
    .where(
      and(
        eq(schema.job.id, jobId),
        eq(schema.deployment.workspaceId, workspaceId),
      ),
    )
    .then((rows) => rows[0]);

  if (existing == null) throw new ApiError("Job not found", 404);

  await db
    .update(schema.job)
    .set({
      status: dbStatus as typeof schema.job.$inferInsert.status,
      updatedAt: new Date(),
      ...(terminalStatuses.has(dbStatus) && {
        completedAt: sql`COALESCE(${schema.job.completedAt}, NOW())`,
      }),
    })
    .where(eq(schema.job.id, jobId));

  await enqueueDesiredRelease(db, {
    workspaceId,
    deploymentId: existing.deploymentId,
    environmentId: existing.environmentId,
    resourceId: existing.resourceId,
  });

  res.status(202).json({
    id: jobId,
    message: "Job status update requested",
  });
};

export const jobsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(getJobs))
  .get("/:jobId", asyncHandler(getJob))
  .get("/:jobId/with-release", asyncHandler(getJobWithRelease))
  .put("/:jobId/status", asyncHandler(updateJobStatus));
