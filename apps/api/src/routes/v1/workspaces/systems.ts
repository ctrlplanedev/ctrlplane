import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

const formatSystem = (sys: typeof schema.system.$inferSelect) => ({
  id: sys.id,
  workspaceId: sys.workspaceId,
  name: sys.name,
  slug: sys.name,
  description: sys.description,
  metadata: sys.metadata,
});

const parseSelector = (raw: string | null | undefined) => {
  if (raw == null || raw === "false") return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { cel: raw };
  }
};

const formatEnvironment = (env: typeof schema.environment.$inferSelect) => ({
  id: env.id,
  name: env.name,
  description: env.description ?? undefined,
  resourceSelector: parseSelector(env.resourceSelector),
  createdAt: env.createdAt.toISOString(),
  metadata: env.metadata,
});

const formatDeployment = (dep: typeof schema.deployment.$inferSelect) => ({
  id: dep.id,
  name: dep.name,
  slug: dep.name,
  description: dep.description,
  jobAgentId: dep.jobAgentId ?? undefined,
  jobAgentConfig: dep.jobAgentConfig,
  jobAgents: dep.jobAgents,
  resourceSelector: parseSelector(dep.resourceSelector),
  metadata: dep.metadata,
});

export const getSystems: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.system)
    .where(eq(schema.system.workspaceId, workspaceId));

  const total = countResult?.total ?? 0;

  const systems = await db
    .select()
    .from(schema.system)
    .where(eq(schema.system.workspaceId, workspaceId))
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    items: systems.map(formatSystem),
    total,
    limit,
    offset,
  });
};

export const getSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "get"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;

  const sys = await db.query.system.findFirst({
    where: and(
      eq(schema.system.id, systemId),
      eq(schema.system.workspaceId, workspaceId),
    ),
  });

  if (sys == null) throw new ApiError("System not found", 404);

  const deploymentRows = await db
    .select({ deployment: schema.deployment })
    .from(schema.systemDeployment)
    .innerJoin(
      schema.deployment,
      eq(schema.systemDeployment.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.systemDeployment.systemId, systemId));

  const environmentRows = await db
    .select({ environment: schema.environment })
    .from(schema.systemEnvironment)
    .innerJoin(
      schema.environment,
      eq(schema.systemEnvironment.environmentId, schema.environment.id),
    )
    .where(eq(schema.systemEnvironment.systemId, systemId));

  res.status(200).json({
    ...formatSystem(sys),
    deployments: deploymentRows.map((r) => formatDeployment(r.deployment)),
    environments: environmentRows.map((r) =>
      formatEnvironment(r.environment),
    ),
  });
};

export const createSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { name, description, metadata } = req.body;

  const id = uuidv4();
  await db.insert(schema.system).values({
    id,
    name,
    description: description ?? "",
    metadata: metadata ?? {},
    workspaceId,
  });

  res.status(202).json({ id, message: "System creation requested" });
};

export const upsertSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "put"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;
  const { name, description, metadata } = req.body;

  await db
    .insert(schema.system)
    .values({
      id: systemId,
      name,
      description: description ?? "",
      metadata: metadata ?? {},
      workspaceId,
    })
    .onConflictDoUpdate({
      target: schema.system.id,
      set: {
        name,
        description: description ?? "",
        metadata: metadata ?? {},
      },
    });

  res.status(202).json({ id: systemId, message: "System update requested" });
};

export const deleteSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;

  const [deleted] = await db
    .delete(schema.system)
    .where(
      and(
        eq(schema.system.id, systemId),
        eq(schema.system.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (deleted == null) throw new ApiError("System not found", 404);

  res.status(202).json({ id: systemId, message: "System delete requested" });
};

export const getDeploymentSystemLink: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
  "get"
> = async (req, res) => {
  const { systemId, deploymentId } = req.params;

  const link = await db.query.systemDeployment.findFirst({
    where: and(
      eq(schema.systemDeployment.systemId, systemId),
      eq(schema.systemDeployment.deploymentId, deploymentId),
    ),
  });

  if (link == null)
    throw new ApiError("Deployment system link not found", 404);

  res.status(200).json({ systemId: link.systemId, deploymentId: link.deploymentId });
};

export const linkDeploymentToSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
  "put"
> = async (req, res) => {
  const { systemId, deploymentId } = req.params;

  await db
    .insert(schema.systemDeployment)
    .values({ systemId, deploymentId })
    .onConflictDoNothing();

  res
    .status(202)
    .json({ id: systemId, message: "Deployment link requested" });
};

export const unlinkDeploymentFromSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
  "delete"
> = async (req, res) => {
  const { systemId, deploymentId } = req.params;

  const [deleted] = await db
    .delete(schema.systemDeployment)
    .where(
      and(
        eq(schema.systemDeployment.systemId, systemId),
        eq(schema.systemDeployment.deploymentId, deploymentId),
      ),
    )
    .returning();

  if (deleted == null)
    throw new ApiError("Deployment system link not found", 404);

  res
    .status(202)
    .json({ id: systemId, message: "Deployment unlink requested" });
};

export const getEnvironmentSystemLink: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
  "get"
> = async (req, res) => {
  const { systemId, environmentId } = req.params;

  const link = await db.query.systemEnvironment.findFirst({
    where: and(
      eq(schema.systemEnvironment.systemId, systemId),
      eq(schema.systemEnvironment.environmentId, environmentId),
    ),
  });

  if (link == null)
    throw new ApiError("Environment system link not found", 404);

  res.status(200).json({ systemId: link.systemId, environmentId: link.environmentId });
};

export const linkEnvironmentToSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
  "put"
> = async (req, res) => {
  const { systemId, environmentId } = req.params;

  await db
    .insert(schema.systemEnvironment)
    .values({ systemId, environmentId })
    .onConflictDoNothing();

  res
    .status(202)
    .json({ id: systemId, message: "Environment link requested" });
};

export const unlinkEnvironmentFromSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
  "delete"
> = async (req, res) => {
  const { systemId, environmentId } = req.params;

  const [deleted] = await db
    .delete(schema.systemEnvironment)
    .where(
      and(
        eq(schema.systemEnvironment.systemId, systemId),
        eq(schema.systemEnvironment.environmentId, environmentId),
      ),
    )
    .returning();

  if (deleted == null)
    throw new ApiError("Environment system link not found", 404);

  res
    .status(202)
    .json({ id: systemId, message: "Environment unlink requested" });
};

export const systemRouter = Router({ mergeParams: true })
  .post("/", asyncHandler(createSystem))
  .get("/", asyncHandler(getSystems))
  .get("/:systemId", asyncHandler(getSystem))
  .delete("/:systemId", asyncHandler(deleteSystem))
  .put("/:systemId", asyncHandler(upsertSystem))
  .get(
    "/:systemId/deployments/:deploymentId",
    asyncHandler(getDeploymentSystemLink),
  )
  .put(
    "/:systemId/deployments/:deploymentId",
    asyncHandler(linkDeploymentToSystem),
  )
  .delete(
    "/:systemId/deployments/:deploymentId",
    asyncHandler(unlinkDeploymentFromSystem),
  )
  .get(
    "/:systemId/environments/:environmentId",
    asyncHandler(getEnvironmentSystemLink),
  )
  .put(
    "/:systemId/environments/:environmentId",
    asyncHandler(linkEnvironmentToSystem),
  )
  .delete(
    "/:systemId/environments/:environmentId",
    asyncHandler(unlinkEnvironmentFromSystem),
  );
