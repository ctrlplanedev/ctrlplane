import { Router } from "express";

import { and, count, desc, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import type { AsyncTypedHandler } from "../../../types/api.js";
import { ApiError, asyncHandler } from "../../../types/api.js";

const UUID_LEN = 36;

const parseReleaseTargetKey = (key: string) => ({
  resourceId: key.substring(0, UUID_LEN),
  environmentId: key.substring(UUID_LEN + 1, UUID_LEN * 2 + 1),
  deploymentId: key.substring(UUID_LEN * 2 + 2),
});

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

const toVersionResponse = (
  v: typeof schema.deploymentVersion.$inferSelect,
) => ({
  id: v.id,
  name: v.name,
  tag: v.tag,
  config: v.config,
  jobAgentConfig: v.jobAgentConfig,
  deploymentId: v.deploymentId,
  status: v.status,
  message: v.message,
  metadata: v.metadata,
  createdAt: v.createdAt.toISOString(),
});

const toJobResponseForState = (
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

const buildReleaseResponse = async (
  releaseRow: typeof schema.release.$inferSelect,
) => {
  const [version, variables] = await Promise.all([
    db
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, releaseRow.versionId))
      .then((rows) => rows[0]),
    db
      .select()
      .from(schema.releaseVariable)
      .where(eq(schema.releaseVariable.releaseId, releaseRow.id)),
  ]);

  const vars: Record<string, unknown> = {};
  const encryptedVars: string[] = [];
  for (const v of variables) {
    vars[v.key] = v.value;
    if (v.encrypted) encryptedVars.push(v.key);
  }

  return {
    id: releaseRow.id,
    createdAt: releaseRow.createdAt.toISOString(),
    releaseTarget: {
      resourceId: releaseRow.resourceId,
      environmentId: releaseRow.environmentId,
      deploymentId: releaseRow.deploymentId,
    },
    variables: vars,
    encryptedVariables: encryptedVars,
    ...(version != null && { version: toVersionResponse(version) }),
  };
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

const getReleaseTargetJobs: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/jobs",
  "get"
> = async (req, res) => {
  const { releaseTargetKey } = req.params;
  const { limit: rawLimit, offset: rawOffset } = req.query;
  const { resourceId, environmentId, deploymentId } =
    parseReleaseTargetKey(releaseTargetKey);

  const limitVal = rawLimit ?? 50;
  const offsetVal = rawOffset ?? 0;

  const releaseTargetFilter = and(
    eq(schema.release.resourceId, resourceId),
    eq(schema.release.environmentId, environmentId),
    eq(schema.release.deploymentId, deploymentId),
  );

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .where(releaseTargetFilter);

  const total = countResult?.total ?? 0;

  const rows = await db
    .select({ job: schema.job, releaseId: schema.releaseJob.releaseId })
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJob.releaseId),
    )
    .where(releaseTargetFilter)
    .orderBy(desc(schema.job.createdAt))
    .limit(limitVal)
    .offset(offsetVal);

  const jobIds = rows.map((r) => r.job.id);
  const metadataMap = await getMetadataForJobs(jobIds);

  res.status(200).json({
    items: rows.map((r) =>
      toJobResponseForState(
        r.job,
        r.releaseId,
        metadataMap.get(r.job.id) ?? {},
      ),
    ),
    total,
    offset: offsetVal,
    limit: limitVal,
  });
};

const getReleaseTargetDesiredRelease: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/desired-release",
  "get"
> = async (req, res) => {
  const { releaseTargetKey } = req.params;
  const { resourceId, environmentId, deploymentId } =
    parseReleaseTargetKey(releaseTargetKey);

  const row = await db
    .select({
      desiredReleaseId: schema.releaseTargetDesiredRelease.desiredReleaseId,
    })
    .from(schema.releaseTargetDesiredRelease)
    .where(
      and(
        eq(schema.releaseTargetDesiredRelease.resourceId, resourceId),
        eq(schema.releaseTargetDesiredRelease.environmentId, environmentId),
        eq(schema.releaseTargetDesiredRelease.deploymentId, deploymentId),
      ),
    )
    .then((rows) => rows[0]);

  if (row?.desiredReleaseId == null)
    throw new ApiError("Release target not found or no desired release", 404);

  const release = await db
    .select()
    .from(schema.release)
    .where(eq(schema.release.id, row.desiredReleaseId))
    .then((rows) => rows[0]);

  if (release == null) throw new ApiError("Desired release not found", 404);

  const releaseResponse = await buildReleaseResponse(release);
  res.status(200).json({ desiredRelease: releaseResponse });
};

const getReleaseTargetState: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state",
  "get"
> = async (req, res) => {
  const { workspaceId, releaseTargetKey } = req.params;

  const { data, error, response } = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state",
    {
      params: { path: { workspaceId, releaseTargetKey } },
    },
  );

  if (error != null)
    throw new ApiError(
      error.error ?? "Failed to get release target state",
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );

  res.status(200).json(data);
};

const getReleaseTargetStates: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/state",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit: rawLimit, offset: rawOffset } = req.query;
  const { deploymentId, environmentId } = req.body;

  const limitVal = rawLimit ?? 50;
  const offsetVal = rawOffset ?? 0;

  const filter = and(
    eq(schema.releaseTargetDesiredRelease.deploymentId, deploymentId),
    eq(schema.releaseTargetDesiredRelease.environmentId, environmentId),
  );

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.releaseTargetDesiredRelease)
    .where(filter);

  const total = countResult?.total ?? 0;

  const releaseTargets = await db
    .select()
    .from(schema.releaseTargetDesiredRelease)
    .where(filter)
    .limit(limitVal)
    .offset(offsetVal);

  const items = await Promise.all(
    releaseTargets.map(async (rt) => {
      const releaseTargetKey = `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`;
      const { data, error, response } = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state",
        { params: { path: { workspaceId, releaseTargetKey } } },
      );

      if (error != null)
        throw new ApiError(
          error.error ?? "Failed to get release target state",
          response.status >= 400 && response.status < 500
            ? response.status
            : 502,
        );

      return {
        releaseTarget: {
          resourceId: rt.resourceId,
          environmentId: rt.environmentId,
          deploymentId: rt.deploymentId,
        },
        state: data,
      };
    }),
  );

  res.status(200).json({ items, total, offset: offsetVal, limit: limitVal });
};

const previewReleaseTargetsForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/resource-preview",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit: rawLimit, offset: rawOffset } = req.query;

  const limitVal = rawLimit ?? 50;
  const offsetVal = rawOffset ?? 0;

  const systems = await db
    .select()
    .from(schema.system)
    .where(eq(schema.system.workspaceId, workspaceId));

  const systemIds = systems.map((s) => s.id);
  if (systemIds.length === 0) {
    res
      .status(200)
      .json({ items: [], total: 0, limit: limitVal, offset: offsetVal });
    return;
  }

  const [sysDeployments, sysEnvironments] = await Promise.all([
    db
      .select({
        systemId: schema.systemDeployment.systemId,
        deployment: schema.deployment,
      })
      .from(schema.systemDeployment)
      .innerJoin(
        schema.deployment,
        eq(schema.deployment.id, schema.systemDeployment.deploymentId),
      )
      .where(inArray(schema.systemDeployment.systemId, systemIds)),
    db
      .select({
        systemId: schema.systemEnvironment.systemId,
        environment: schema.environment,
      })
      .from(schema.systemEnvironment)
      .innerJoin(
        schema.environment,
        eq(schema.environment.id, schema.systemEnvironment.environmentId),
      )
      .where(inArray(schema.systemEnvironment.systemId, systemIds)),
  ]);

  const depsBySystem = new Map<string, (typeof sysDeployments)[number][]>();
  for (const sd of sysDeployments) {
    const arr = depsBySystem.get(sd.systemId) ?? [];
    arr.push(sd);
    depsBySystem.set(sd.systemId, arr);
  }
  const envsBySystem = new Map<string, (typeof sysEnvironments)[number][]>();
  for (const se of sysEnvironments) {
    const arr = envsBySystem.get(se.systemId) ?? [];
    arr.push(se);
    envsBySystem.set(se.systemId, arr);
  }

  const allMatches: Array<{
    system: typeof schema.system.$inferSelect;
    deployment: typeof schema.deployment.$inferSelect;
    environment: typeof schema.environment.$inferSelect;
  }> = [];

  for (const sys of systems) {
    const deps = depsBySystem.get(sys.id) ?? [];
    const envs = envsBySystem.get(sys.id) ?? [];
    for (const dep of deps) {
      for (const env of envs) {
        allMatches.push({
          system: sys,
          deployment: dep.deployment,
          environment: env.environment,
        });
      }
    }
  }

  allMatches.sort((a, b) => {
    if (a.system.name !== b.system.name)
      return a.system.name.localeCompare(b.system.name);
    if (a.deployment.name !== b.deployment.name)
      return a.deployment.name.localeCompare(b.deployment.name);
    return a.environment.name.localeCompare(b.environment.name);
  });

  const total = allMatches.length;
  const start = Math.min(offsetVal, total);
  const end = Math.min(start + limitVal, total);
  const page = allMatches.slice(start, end);

  res.status(200).json({
    items: page,
    total,
    limit: limitVal,
    offset: offsetVal,
  });
};

const releaseTargetKeyRouter = Router({ mergeParams: true })
  .get("/jobs", asyncHandler(getReleaseTargetJobs))
  .get("/desired-release", asyncHandler(getReleaseTargetDesiredRelease))
  .get("/state", asyncHandler(getReleaseTargetState));

export const releaseTargetsRouter = Router({ mergeParams: true })
  .post("/state", asyncHandler(getReleaseTargetStates))
  .post("/resource-preview", asyncHandler(previewReleaseTargetsForResource))
  .use("/:releaseTargetKey", releaseTargetKeyRouter);
