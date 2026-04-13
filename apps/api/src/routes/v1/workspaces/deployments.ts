import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { and, asc, count, desc, eq, inArray, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  enqueueDeploymentPlan,
  enqueuePolicyEval,
  enqueueReleaseTargetsForDeployment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

// 1 hour

import { validResourceSelector } from "../valid-selector.js";
import { listDeploymentVariablesByDeploymentRouter } from "./deployment-variables.js";

const PLAN_TTL_MS = 60 * 60 * 1000;

const parseSelector = (raw: string | null | undefined): string | undefined => {
  if (raw == null || raw === "false") return undefined;
  return raw;
};

const formatDeployment = (dep: typeof schema.deployment.$inferSelect) => ({
  id: dep.id,
  name: dep.name,
  slug: dep.name,
  description: dep.description,
  resourceSelector: parseSelector(dep.resourceSelector),
  jobAgentSelector: parseSelector(dep.jobAgentSelector),
  jobAgentConfig: dep.jobAgentConfig ?? {},
  metadata: dep.metadata,
});

const formatSystem = (sys: typeof schema.system.$inferSelect) => ({
  id: sys.id,
  workspaceId: sys.workspaceId,
  name: sys.name,
  slug: sys.name,
  description: sys.description,
  metadata: sys.metadata,
});

const formatDeploymentVersion = (
  ver: typeof schema.deploymentVersion.$inferSelect,
) => ({
  id: ver.id,
  name: ver.name,
  tag: ver.tag,
  config: ver.config,
  jobAgentConfig: ver.jobAgentConfig,
  deploymentId: ver.deploymentId,
  status: ver.status,
  message: ver.message ?? undefined,
  createdAt: ver.createdAt.toISOString(),
  metadata: ver.metadata,
});

const listDeployments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;
  const cel = req.query.cel;

  const { data, error, response } = await getClientFor().GET(
    "/v1/workspaces/{workspaceId}/deployments",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset, cel },
      },
    },
  );

  if (error != null)
    throw new ApiError(
      error.error ?? "Failed to list deployments",
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );

  res.status(200).json(data);
};

const getDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  const dep = await db.query.deployment.findFirst({
    where: and(
      eq(schema.deployment.id, deploymentId),
      eq(schema.deployment.workspaceId, workspaceId),
    ),
  });

  if (dep == null) throw new ApiError("Deployment not found", 404);

  const systemRows = await db
    .select({ system: schema.system })
    .from(schema.systemDeployment)
    .innerJoin(
      schema.system,
      eq(schema.systemDeployment.systemId, schema.system.id),
    )
    .where(eq(schema.systemDeployment.deploymentId, deploymentId));

  const variables = await db
    .select()
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.deploymentId, deploymentId));

  const variableIds = variables.map((v) => v.id);
  const variableValues =
    variableIds.length > 0
      ? await db
          .select()
          .from(schema.deploymentVariableValue)
          .where(
            inArray(
              schema.deploymentVariableValue.deploymentVariableId,
              variableIds,
            ),
          )
      : [];

  const valuesByVariableId = new Map<
    string,
    (typeof schema.deploymentVariableValue.$inferSelect)[]
  >();
  for (const val of variableValues) {
    const arr = valuesByVariableId.get(val.deploymentVariableId) ?? [];
    arr.push(val);
    valuesByVariableId.set(val.deploymentVariableId, arr);
  }

  res.status(200).json({
    deployment: formatDeployment(dep),
    systems: systemRows.map((r) => formatSystem(r.system)),
    variables: variables.map((v) => ({
      variable: {
        id: v.id,
        key: v.key,
        deploymentId: v.deploymentId,
        description: v.description ?? undefined,
        defaultValue: v.defaultValue ?? undefined,
      },
      values: (valuesByVariableId.get(v.id) ?? []).map((val) => ({
        id: val.id,
        deploymentVariableId: val.deploymentVariableId,
        priority: val.priority,
        value: val.value,
        resourceSelector: parseSelector(val.resourceSelector),
      })),
    })),
  });
};

const postDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const isValid = validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  const id = uuidv4();

  await db.insert(schema.deployment).values({
    id,
    name: body.name,
    description: body.description ?? "",
    resourceSelector: body.resourceSelector ?? "false",
    jobAgentSelector: body.jobAgentSelector ?? "false",
    jobAgentConfig: body.jobAgentConfig ?? {},
    metadata: body.metadata ?? {},
    workspaceId,
  });

  enqueueReleaseTargetsForDeployment(db, workspaceId, id);

  res.status(202).json({ id, message: "Deployment creation requested" });
};

const upsertDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const isValid = validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  const jobAgentConfig = body.jobAgentConfig ?? {};

  await db
    .insert(schema.deployment)
    .values({
      id: deploymentId,
      name: body.name,
      description: body.description ?? "",
      resourceSelector: body.resourceSelector ?? "false",
      jobAgentSelector: body.jobAgentSelector ?? "false",
      jobAgentConfig,
      metadata: body.metadata ?? {},
      workspaceId,
    })
    .onConflictDoUpdate({
      target: schema.deployment.id,
      set: {
        name: body.name,
        description: body.description ?? "",
        resourceSelector: body.resourceSelector ?? "false",
        metadata: body.metadata ?? {},
        ...(body.jobAgentSelector != null
          ? { jobAgentSelector: body.jobAgentSelector, jobAgentConfig }
          : {}),
      },
    });

  enqueueReleaseTargetsForDeployment(db, workspaceId, deploymentId);

  res
    .status(202)
    .json({ id: deploymentId, message: "Deployment update requested" });
};

const deleteDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  const [deleted] = await db
    .delete(schema.deployment)
    .where(
      and(
        eq(schema.deployment.id, deploymentId),
        eq(schema.deployment.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (deleted == null) throw new ApiError("Deployment not found", 404);

  res
    .status(202)
    .json({ id: deploymentId, message: "Deployment delete requested" });
};

const listDeploymentVersions: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "get"
> = async (req, res) => {
  const { deploymentId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;
  const order = req.query.order ?? "desc";

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.deploymentId, deploymentId));

  const total = countResult?.total ?? 0;

  const versions = await db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.deploymentId, deploymentId))
    .orderBy(
      order === "asc"
        ? asc(schema.deploymentVersion.createdAt)
        : desc(schema.deploymentVersion.createdAt),
    )
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    items: versions.map(formatDeploymentVersion),
    total,
    limit,
    offset,
  });
};

const createDeploymentVersion: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "post"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const data = {
    ...body,
    name: body.name === "" ? body.tag : body.name,
    config: body.config ?? {},
    jobAgentConfig: body.jobAgentConfig ?? {},
    metadata: body.metadata ?? {},
    deploymentId,
    createdAt: new Date(),
    id: uuidv4(),
  };

  const version = await db.transaction(async (tx) => {
    const version = await tx
      .insert(schema.deploymentVersion)
      .values(data)
      .onConflictDoNothing()
      .returning()
      .then(takeFirst);

    return version;
  });

  enqueueReleaseTargetsForDeployment(db, workspaceId, deploymentId);
  enqueuePolicyEval(db, workspaceId, version.id);

  res.status(200).json(formatDeploymentVersion(version));
};

const createDeploymentPlan: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/plan",
  "post"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const dep = await db.query.deployment.findFirst({
    where: and(
      eq(schema.deployment.id, deploymentId),
      eq(schema.deployment.workspaceId, workspaceId),
    ),
  });

  if (dep == null) throw new ApiError("Deployment not found", 404);

  const planId = uuidv4();
  const expiresAt = new Date(Date.now() + PLAN_TTL_MS);

  const { version } = body;

  await db.insert(schema.deploymentPlan).values({
    id: planId,
    workspaceId,
    deploymentId,
    versionTag: version.tag,
    versionName: version.name ?? version.tag,
    versionConfig: version.config ?? {},
    versionJobAgentConfig: version.jobAgentConfig ?? {},
    versionMetadata: version.metadata ?? {},
    metadata: body.metadata ?? {},
    expiresAt,
  });

  enqueueDeploymentPlan(db, workspaceId, planId);

  res.status(202).json({
    id: planId,
    status: "computing",
    summary: { total: 0, changed: 0, unchanged: 0, errored: 0, unsupported: 0 },
    targets: [],
  });
};

const getDeploymentPlan: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/plan/{planId}",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId, planId } = req.params;

  const plan = await db.query.deploymentPlan.findFirst({
    where: and(
      eq(schema.deploymentPlan.id, planId),
      eq(schema.deploymentPlan.workspaceId, workspaceId),
      eq(schema.deploymentPlan.deploymentId, deploymentId),
    ),
    with: {
      targets: {
        with: {
          environment: true,
          resource: true,
          results: true,
        },
      },
    },
  });

  if (plan == null) throw new ApiError("Deployment plan not found", 404);

  const allResults = plan.targets.flatMap((t) => t.results);

  const targets = plan.targets.map((t) => ({
    environmentId: t.environmentId,
    environmentName: t.environment.name,
    resourceId: t.resourceId,
    resourceName: t.resource.name,
    hasChanges: t.results.some((r) => r.hasChanges === true),
    results: t.results.map((r) => ({
      id: r.id,
      status: r.status,
      hasChanges: r.hasChanges ?? false,
      contentHash: r.contentHash ?? "",
      current: r.current ?? "",
      proposed: r.proposed ?? "",
      message: r.message ?? "",
    })),
  }));

  const computing = allResults.filter((r) => r.status === "computing").length;
  const changed = allResults.filter((r) => r.hasChanges === true).length;
  const unchanged = allResults.filter((r) => r.hasChanges === false).length;
  const errored = allResults.filter((r) => r.status === "errored").length;
  const unsupported = allResults.filter(
    (r) => r.status === "unsupported",
  ).length;

  const status =
    computing > 0 ? "computing" : errored > 0 ? "failed" : "completed";
  const summary = {
    total: allResults.length,
    changed,
    unchanged,
    errored,
    unsupported,
  };

  res.status(200).json({
    id: plan.id,
    status,
    summary,
    targets,
  });
};

export const deploymentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeployments))
  .post("/", asyncHandler(postDeployment))
  .get("/:deploymentId", asyncHandler(getDeployment))
  .put("/:deploymentId", asyncHandler(upsertDeployment))
  .delete("/:deploymentId", asyncHandler(deleteDeployment))
  .get("/:deploymentId/versions", asyncHandler(listDeploymentVersions))
  .post("/:deploymentId/versions", asyncHandler(createDeploymentVersion))
  .post("/:deploymentId/plan", asyncHandler(createDeploymentPlan))
  .get("/:deploymentId/plan/:planId", asyncHandler(getDeploymentPlan))
  .use("/:deploymentId/variables", listDeploymentVariablesByDeploymentRouter);
