import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { evaluate } from "cel-js";
import { Router } from "express";

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  enqueueManyDeploymentSelectorEval,
  enqueueManyEnvironmentSelectorEval,
  enqueueReleaseTargetsForResource,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { validResourceSelector } from "../valid-selector.js";
import { extractMessageFromError } from "./utils.js";

type VariableValueShape = {
  kind: typeof schema.variableValue.kind.enumValues[number];
  literalValue: unknown;
  refKey: string | null;
  refPath: string[] | null;
  secretProvider: string | null;
  secretKey: string | null;
  secretPath: string[] | null;
};

const flattenResourceVariableValue = (r: VariableValueShape): unknown => {
  if (r.kind === "literal") return r.literalValue;
  if (r.kind === "ref")
    return { reference: r.refKey, path: r.refPath ?? [] };
  return {
    provider: r.secretProvider,
    key: r.secretKey,
    path: r.secretPath ?? [],
  };
};

const listResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit: rawLimit, offset: rawOffset, cel } = req.query;

  const limit = rawLimit ?? 1000;
  const offset = rawOffset ?? 0;

  const isValid = validResourceSelector(cel);
  if (!isValid) {
    res.status(400).json({ error: "Invalid resource selector" });
    return;
  }

  const allResources = await db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.workspaceId, workspaceId));

  const filteredResources = allResources.filter((resource) => {
    if (cel == null) return true;
    try {
      return evaluate(cel, { resource });
    } catch {
      return false;
    }
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
          .delete(schema.variable)
          .where(
            and(
              eq(schema.variable.scope, "resource"),
              eq(schema.variable.resourceId, upsertedResource.id),
            ),
          );

        const entries = Object.entries(variables);
        if (entries.length > 0) {
          const inserted = await tx
            .insert(schema.variable)
            .values(
              entries.map(([key]) => ({
                scope: "resource" as const,
                resourceId: upsertedResource.id,
                key,
              })),
            )
            .returning({
              id: schema.variable.id,
              key: schema.variable.key,
            });

          const byKey = new Map(inserted.map((v) => [v.key, v.id]));
          await tx.insert(schema.variableValue).values(
            entries.map(([key, value]) => ({
              variableId: byKey.get(key)!,
              priority: 0,
              kind: "literal" as const,
              literalValue:
                value != null && typeof value === "object"
                  ? { object: value }
                  : value,
            })),
          );
        }
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

  const limit = req.query.limit ?? 1000;
  const offset = req.query.offset ?? 0;

  const rows = await db
    .select({
      resourceId: schema.variable.resourceId,
      key: schema.variable.key,
      kind: schema.variableValue.kind,
      literalValue: schema.variableValue.literalValue,
      refKey: schema.variableValue.refKey,
      refPath: schema.variableValue.refPath,
      secretProvider: schema.variableValue.secretProvider,
      secretKey: schema.variableValue.secretKey,
      secretPath: schema.variableValue.secretPath,
    })
    .from(schema.variable)
    .innerJoin(
      schema.variableValue,
      eq(schema.variableValue.variableId, schema.variable.id),
    )
    .where(
      and(
        eq(schema.variable.scope, "resource"),
        eq(schema.variable.resourceId, resource.id),
      ),
    );

  const items = rows.slice(offset, offset + limit).map((r) => ({
    resourceId: r.resourceId,
    key: r.key,
    value: flattenResourceVariableValue(r),
  }));

  res.status(200).json({ items, total: rows.length, limit, offset });
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
        .delete(schema.variable)
        .where(
          and(
            eq(schema.variable.scope, "resource"),
            eq(schema.variable.resourceId, resource.id),
          ),
        );
      const entries = Object.entries(body);
      if (entries.length > 0) {
        const inserted = await tx
          .insert(schema.variable)
          .values(
            entries.map(([key]) => ({
              scope: "resource" as const,
              resourceId,
              key,
            })),
          )
          .returning({
            id: schema.variable.id,
            key: schema.variable.key,
          });

        const byKey = new Map(inserted.map((v) => [v.key, v.id]));
        await tx.insert(schema.variableValue).values(
          entries.map(([key, value]) => ({
            variableId: byKey.get(key)!,
            priority: 0,
            kind: "literal" as const,
            literalValue:
              value != null && typeof value === "object"
                ? { object: value }
                : value,
          })),
        );
      }
    });

    enqueueReleaseTargetsForResource(db, workspaceId, resourceId);

    res.status(202).json({
      id: resource.id,
      message: "Resource variables update requested",
    });
  } catch (error) {
    res.status(error instanceof ApiError ? error.statusCode : 500).json({
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

const searchResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/search",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;

  const {
    providerIds,
    versions,
    identifiers,
    query,
    kinds,
    limit,
    offset,
    metadata,
    sortBy,
    order,
  } = req.body;

  if (!Number.isInteger(limit) || limit < 0) {
    res.status(400).json({ error: "`limit` must be a non-negative integer" });
    return;
  }

  if (!Number.isInteger(offset) || offset < 0) {
    res.status(400).json({ error: "`offset` must be a non-negative integer" });
    return;
  }

  const escapedQuery = query != null ? query.replace(/[%_\\]/g, "\\$&") : null;

  function isDefined<T>(value: T | null | undefined): value is T {
    return value != null;
  }

  const conditions = [
    eq(schema.resource.workspaceId, workspaceId),
    providerIds?.length
      ? inArray(schema.resource.providerId, providerIds)
      : undefined,
    versions?.length ? inArray(schema.resource.version, versions) : undefined,
    identifiers?.length
      ? inArray(schema.resource.identifier, identifiers)
      : undefined,
    escapedQuery != null
      ? or(
          ilike(schema.resource.name, `%${escapedQuery}%`),
          ilike(schema.resource.identifier, `%${escapedQuery}%`),
        )
      : undefined,
    kinds?.length ? inArray(schema.resource.kind, kinds) : undefined,
    ...(metadata
      ? Object.entries(metadata).map(
          ([key, value]) =>
            sql`${schema.resource.metadata}->>${key} = ${value}`,
        )
      : []),
  ].filter(isDefined);

  const orderCol =
    sortBy === "updatedAt"
      ? schema.resource.updatedAt
      : sortBy === "name"
        ? schema.resource.name
        : sortBy === "kind"
          ? schema.resource.kind
          : schema.resource.createdAt;

  const orderFn = order === "desc" ? desc : asc;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.resource)
      .where(and(...conditions))
      .then((r) => r[0]),
    db
      .select()
      .from(schema.resource)
      .where(and(...conditions))
      .orderBy(orderFn(orderCol), orderFn(schema.resource.identifier))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult?.total ?? 0;

  res.status(200).json({
    items: rows.map(toResourceResponse),
    total,
    limit,
    offset,
  });
};

export const resourceRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listResources))
  .post("/search", asyncHandler(searchResources))
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
