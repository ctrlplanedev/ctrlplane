import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { evaluate } from "cel-js";
import { Router } from "express";

import { and, asc, count, eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  enqueueManyDeploymentSelectorEval,
  enqueueManyEnvironmentSelectorEval,
  enqueueReleaseTargetsForResource,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { validResourceSelector } from "../valid-selector.js";
import { extractMessageFromError } from "./utils.js";

const listResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit: rawLimit, offset: rawOffset, cel } = req.query;

  const limit = rawLimit ?? 1000;
  const offset = rawOffset ?? 0;

  const decodedCel =
    typeof cel === "string" ? decodeURIComponent(cel.replace(/\+/g, " ")) : cel;

  const isValid = validResourceSelector(decodedCel);
  if (!isValid) {
    res.status(400).json({ error: "Invalid resource selector" });
    return;
  }

  const allResources = await db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.workspaceId, workspaceId));

  const filteredResources = allResources.filter((resource) => {
    if (decodedCel == null) return true;
    const matches = evaluate(decodedCel, { resource });
    return matches;
  });

  const total = filteredResources.length;
  const paginatedResources = filteredResources.slice(offset, offset + limit);

  res.status(200).json({
    items: paginatedResources.map(toResourceResponse),
    total,
    offset,
    limit,
  });
};

const findResource = async (workspaceId: string, identifier: string) => {
  const resource = await db.query.resource.findFirst({
    where: and(
      eq(schema.resource.workspaceId, workspaceId),
      eq(schema.resource.identifier, identifier),
    ),
  });
  if (resource == null) throw new ApiError("Resource not found", 404);
  return resource;
};

const toResourceResponse = (
  r: NonNullable<Awaited<ReturnType<typeof findResource>>>,
) => ({
  id: r.id,
  identifier: r.identifier,
  name: r.name,
  kind: r.kind,
  version: r.version,
  config: r.config,
  metadata: r.metadata ?? {},
  workspaceId: r.workspaceId,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt?.toISOString(),
  deletedAt: r.deletedAt?.toISOString(),
  providerId: r.providerId,
});

const getResourceByIdentifier: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
  "get"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;
  const resource = await findResource(workspaceId, identifier);
  res.status(200).json(toResourceResponse(resource));
};

const upsertResourceByIdentifier: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
  "put"
> = async (req, res) => {
  try {
    const { workspaceId, identifier } = req.params;
    const { name, version, kind, config, metadata, variables } = req.body;

    const upsertedResource = await db
      .insert(schema.resource)
      .values({
        name,
        version,
        kind,
        identifier,
        workspaceId,
        config: config ?? {},
        metadata: metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [schema.resource.identifier, schema.resource.workspaceId],
        set: {
          name,
          version,
          kind,
          config: config ?? {},
          metadata: metadata ?? {},
        },
      })
      .returning()
      .then(takeFirst);

    if (variables != null)
      await db.transaction(async (tx) => {
        await tx
          .delete(schema.resourceVariable)
          .where(eq(schema.resourceVariable.resourceId, upsertedResource.id));

        const entries = Object.entries(variables);
        if (entries.length > 0)
          await tx.insert(schema.resourceVariable).values(
            entries.map(([key, value]) => ({
              resourceId: upsertedResource.id,
              key,
              value,
            })),
          );
      });

    enqueueReleaseTargetsForResource(db, workspaceId, upsertedResource.id);

    res.status(202).json({
      id: upsertedResource.id,
      message: "Resource upsert requested",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upsert resource",
      message: extractMessageFromError(error),
    });
  }
};

const deleteResourceByIdentifier: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
  "delete"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;
  const resource = await findResource(workspaceId, identifier);

  await db.delete(schema.resource).where(eq(schema.resource.id, resource.id));

  const [environments, deployments] = await Promise.all([
    db
      .select({ id: schema.environment.id })
      .from(schema.environment)
      .where(eq(schema.environment.workspaceId, workspaceId)),
    db
      .select({ id: schema.deployment.id })
      .from(schema.deployment)
      .where(eq(schema.deployment.workspaceId, workspaceId)),
  ]);

  await Promise.all([
    enqueueManyEnvironmentSelectorEval(
      db,
      environments.map((e) => ({ workspaceId, environmentId: e.id })),
    ),
    enqueueManyDeploymentSelectorEval(
      db,
      deployments.map((d) => ({ workspaceId, deploymentId: d.id })),
    ),
  ]);

  res.status(200).json({
    id: resource.id,
    message: "Resource deleted",
  });
};

const getVariablesForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
  "get"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;
  const resource = await findResource(workspaceId, identifier);

  const rows = await db
    .select({
      resourceId: schema.resourceVariable.resourceId,
      key: schema.resourceVariable.key,
      value: schema.resourceVariable.value,
    })
    .from(schema.resourceVariable)
    .where(eq(schema.resourceVariable.resourceId, resource.id));

  res.status(200).json(rows);
};

const updateVariablesForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
  "patch"
> = async (req, res) => {
  try {
    const { workspaceId, identifier } = req.params;
    const { body } = req;

    const resource = await findResource(workspaceId, identifier);
    const { id: resourceId } = resource;

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.resourceVariable)
        .where(eq(schema.resourceVariable.resourceId, resource.id));
      const entries = Object.entries(body);
      if (entries.length > 0)
        await tx.insert(schema.resourceVariable).values(
          entries.map(([key, value]) => ({
            resourceId,
            key,
            value,
          })),
        );
    });

    enqueueReleaseTargetsForResource(db, workspaceId, resourceId);

    res.status(202).json({
      id: resource.id,
      message: "Resource variables update requested",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update resource variables",
      message: extractMessageFromError(error),
    });
  }
};

const parseSelector = (raw: string | null | undefined): string | undefined => {
  if (raw == null || raw === "false") return undefined;
  return raw;
};

const getDeploymentsForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/deployments",
  "get"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;
  const { limit: rawLimit, offset: rawOffset } = req.query;
  const resource = await findResource(workspaceId, identifier);

  const limitVal = rawLimit ?? 50;
  const offsetVal = rawOffset ?? 0;

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.computedDeploymentResource)
    .where(eq(schema.computedDeploymentResource.resourceId, resource.id));

  const total = countResult?.total ?? 0;

  const rows = await db
    .select({ deployment: schema.deployment })
    .from(schema.computedDeploymentResource)
    .innerJoin(
      schema.deployment,
      eq(schema.computedDeploymentResource.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.computedDeploymentResource.resourceId, resource.id))
    .orderBy(asc(schema.deployment.name))
    .limit(limitVal)
    .offset(offsetVal);

  const items = rows.map((r) => ({
    id: r.deployment.id,
    name: r.deployment.name,
    slug: r.deployment.name,
    description: r.deployment.description,
    jobAgentId: r.deployment.jobAgentId ?? undefined,
    jobAgentConfig: r.deployment.jobAgentConfig,
    jobAgents: r.deployment.jobAgents,
    resourceSelector: parseSelector(r.deployment.resourceSelector),
    metadata: r.deployment.metadata,
  }));

  res.status(200).json({ items, total, offset: offsetVal, limit: limitVal });
};

const getReleaseTargetForResourceInDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets/deployment/{deploymentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, resourceIdentifier, deploymentId } = req.params;
  const resource = await findResource(workspaceId, resourceIdentifier);

  const releaseTarget = await db.query.releaseTargetDesiredRelease.findFirst({
    where: and(
      eq(schema.releaseTargetDesiredRelease.resourceId, resource.id),
      eq(schema.releaseTargetDesiredRelease.deploymentId, deploymentId),
    ),
  });

  if (releaseTarget == null)
    throw new ApiError("Release target not found", 404);

  res.status(200).json({
    resourceId: releaseTarget.resourceId,
    environmentId: releaseTarget.environmentId,
    deploymentId: releaseTarget.deploymentId,
  });
};

export const resourceRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listResources))
  .get("/identifier/:identifier", asyncHandler(getResourceByIdentifier))
  .put("/identifier/:identifier", asyncHandler(upsertResourceByIdentifier))
  .delete("/identifier/:identifier", asyncHandler(deleteResourceByIdentifier))
  .get(
    "/identifier/:identifier/variables",
    asyncHandler(getVariablesForResource),
  )
  .patch(
    "/identifier/:identifier/variables",
    asyncHandler(updateVariablesForResource),
  )
  .get(
    "/identifier/:identifier/deployments",
    asyncHandler(getDeploymentsForResource),
  )
  .get(
    "/identifier/:identifier/release-targets/deployment/:deploymentId",
    asyncHandler(getReleaseTargetForResourceInDeployment),
  );
