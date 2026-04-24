import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, count, eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  enqueueAllReleaseTargetsDesiredVersion,
  enqueueReleaseTargetsForEnvironment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { validResourceSelector } from "../valid-selector.js";

const parseSelector = (
  raw: string | null | undefined,
): string | undefined => {
  if (raw == null || raw === "false") return undefined;
  return raw;
};

const formatEnvironment = (env: typeof schema.environment.$inferSelect) => ({
  id: env.id,
  name: env.name,
  description: env.description ?? undefined,
  resourceSelector: parseSelector(env.resourceSelector),
  createdAt: env.createdAt.toISOString(),
  metadata: env.metadata,
});

const listEnvironments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.environment)
    .where(eq(schema.environment.workspaceId, workspaceId));

  const total = countResult?.total ?? 0;

  const environments = await db
    .select()
    .from(schema.environment)
    .where(eq(schema.environment.workspaceId, workspaceId))
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    items: environments.map(formatEnvironment),
    total,
    limit,
    offset,
  });
};

const getEnvironmentWithSystems = async (
  env: typeof schema.environment.$inferSelect,
) => {
  const systemRows = await db
    .select({ system: schema.system })
    .from(schema.systemEnvironment)
    .innerJoin(
      schema.system,
      eq(schema.systemEnvironment.systemId, schema.system.id),
    )
    .where(eq(schema.systemEnvironment.environmentId, env.id));

  const systems = systemRows.map((r) => ({
    id: r.system.id,
    workspaceId: r.system.workspaceId,
    name: r.system.name,
    slug: r.system.name,
    description: r.system.description,
    metadata: r.system.metadata,
  }));

  return { ...formatEnvironment(env), systems };
};

const getEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;

  const env = await db.query.environment.findFirst({
    where: and(
      eq(schema.environment.id, environmentId),
      eq(schema.environment.workspaceId, workspaceId),
    ),
  });

  if (env == null) throw new ApiError("Environment not found", 404);

  res.status(200).json(await getEnvironmentWithSystems(env));
};

const getEnvironmentByName: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/name/{name}",
  "get"
> = async (req, res) => {
  const { workspaceId, name } = req.params;

  const env = await db.query.environment.findFirst({
    where: and(
      eq(schema.environment.name, name),
      eq(schema.environment.workspaceId, workspaceId),
    ),
  });

  if (env == null) throw new ApiError("Environment not found", 404);

  res.status(200).json(await getEnvironmentWithSystems(env));
};

const deleteEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;

  const [deleted] = await db
    .delete(schema.environment)
    .where(
      and(
        eq(schema.environment.id, environmentId),
        eq(schema.environment.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (deleted == null) throw new ApiError("Environment not found", 404);

  enqueueAllReleaseTargetsDesiredVersion(db, workspaceId);

  res
    .status(202)
    .json({ id: environmentId, message: "Environment delete requested" });
};

const createEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const isValid = validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  const created = await db
    .insert(schema.environment)
    .values({
      name: body.name,
      description: body.description ?? "",
      resourceSelector: body.resourceSelector ?? "false",
      metadata: body.metadata ?? {},
      workspaceId,
    })
    .returning()
    .then(takeFirst)
    .catch((error: any) => {
      if (error.code === "23505")
        throw new ApiError(
          "Environment name already exists in this workspace",
          409,
          "DUPLICATE_NAME",
        );
      throw error;
    });

  enqueueReleaseTargetsForEnvironment(db, workspaceId, created.id);

  res
    .status(202)
    .json({ id: created.id, message: "Environment creation requested" });
};

export const upsertEnvironmentById: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;
  const { body } = req;

  const isValid = validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  try {
    await db
      .insert(schema.environment)
      .values({
        id: environmentId,
        name: body.name,
        description: body.description ?? "",
        resourceSelector: body.resourceSelector ?? "false",
        metadata: body.metadata ?? {},
        workspaceId,
      })
      .onConflictDoUpdate({
        target: schema.environment.id,
        set: {
          name: body.name,
          description: body.description ?? "",
          resourceSelector: body.resourceSelector ?? "false",
          metadata: body.metadata ?? {},
        },
      });
  } catch (error: any) {
    if (error.code === "23505")
      throw new ApiError(
        "Environment name already exists in this workspace",
        409,
        "DUPLICATE_NAME",
      );
    throw error;
  }

  enqueueReleaseTargetsForEnvironment(db, workspaceId, environmentId);

  res
    .status(202)
    .json({ id: environmentId, message: "Environment update requested" });
};

export const environmentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listEnvironments))
  .post("/", asyncHandler(createEnvironment))
  .get("/name/:name", asyncHandler(getEnvironmentByName))
  .get("/:environmentId", asyncHandler(getEnvironment))
  .put("/:environmentId", asyncHandler(upsertEnvironmentById))
  .delete("/:environmentId", asyncHandler(deleteEnvironment));
