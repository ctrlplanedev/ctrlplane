import type { AsyncTypedHandler } from "@/types/api.js";
import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import {
  and,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  enqueueManyDeploymentSelectorEval,
  enqueueManyEnvironmentSelectorEval,
} from "@ctrlplane/db/reconcilers";
import {
  deployment,
  environment,
  resource,
  resourceProvider,
} from "@ctrlplane/db/schema";

const upsertResourceProvider: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers",
  "put"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { name } = req.body;

  const provider = await db
    .insert(resourceProvider)
    .values({ workspaceId, name })
    .onConflictDoUpdate({
      target: [resourceProvider.workspaceId, resourceProvider.name],
      set: { name },
    })
    .returning()
    .then(takeFirstOrNull);

  if (provider == null) {
    res.status(500).json({ error: "Failed to upsert resource provider" });
    return;
  }

  res.status(202).json(provider);
};

const getResourceProviderByName: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
  "get"
> = async (req, res) => {
  const { workspaceId, name } = req.params;

  const provider = await db
    .select()
    .from(resourceProvider)
    .where(
      and(
        eq(resourceProvider.workspaceId, workspaceId),
        eq(resourceProvider.name, name),
      ),
    )
    .then(takeFirstOrNull);

  if (!provider) {
    res.status(404).json({ error: "Resource provider not found" });
    return;
  }

  res.status(200).json(provider);
};

const setResourceProviderResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
  "put"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;
  const { resources: incoming } = req.body;

  const incomingIdentifiers = incoming.map((r: any) => r.identifier as string);

  await db.transaction(async (tx) => {
    if (incomingIdentifiers.length > 0) {
      const existing = await tx
        .select({
          id: resource.id,
          identifier: resource.identifier,
          providerId: resource.providerId,
        })
        .from(resource)
        .where(
          and(
            eq(resource.workspaceId, workspaceId),
            inArray(resource.identifier, incomingIdentifiers),
          ),
        );

      const existingByIdentifier = new Map(
        existing.map((r) => [r.identifier, r]),
      );

      for (const r of incoming as any[]) {
        const match = existingByIdentifier.get(r.identifier);

        if (match?.providerId != null && match.providerId !== providerId)
          continue;

        await tx
          .insert(resource)
          .values({
            identifier: r.identifier,
            name: r.name,
            version: r.version,
            kind: r.kind,
            workspaceId,
            providerId,
            config: r.config ?? {},
            metadata: r.metadata ?? {},
          })
          .onConflictDoUpdate({
            target: [resource.identifier, resource.workspaceId],
            set: {
              name: r.name,
              version: r.version,
              kind: r.kind,
              config: r.config ?? {},
              metadata: r.metadata ?? {},
              providerId,
              updatedAt: sql`now()`,
            },
          });
      }
    }

    await tx
      .delete(resource)
      .where(
        and(
          eq(resource.workspaceId, workspaceId),
          eq(resource.providerId, providerId),
          incomingIdentifiers.length > 0
            ? notInArray(resource.identifier, incomingIdentifiers)
            : undefined,
        ),
      );

    const deployments = await tx
      .select({ id: deployment.id })
      .from(deployment)
      .where(eq(deployment.workspaceId, workspaceId));

    const environments = await tx
      .select({ id: environment.id })
      .from(environment)
      .where(eq(environment.workspaceId, workspaceId));

    await enqueueManyDeploymentSelectorEval(
      tx,
      deployments.map((d) => ({ workspaceId, deploymentId: d.id })),
    );

    await enqueueManyEnvironmentSelectorEval(
      tx,
      environments.map((e) => ({ workspaceId, environmentId: e.id })),
    );
  });

  res.status(202).json({ ok: true, method: "direct" });
};

const getResourceProviderResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/name/{name}/resources",
  "get"
> = async (req, res) => {
  const { workspaceId, name } = req.params;

  const provider = await db
    .select()
    .from(resourceProvider)
    .where(
      and(
        eq(resourceProvider.workspaceId, workspaceId),
        eq(resourceProvider.name, name),
      ),
    )
    .then(takeFirstOrNull);

  if (provider == null) {
    res.status(404).json({ error: "Resource provider not found" });
    return;
  }

  const resources = await db
    .select()
    .from(resource)
    .where(eq(resource.providerId, provider.id))
    .orderBy(desc(resource.createdAt));

  res.status(200).json({ items: resources, total: resources.length });
};

export const resourceProvidersRouter = Router({ mergeParams: true })
  .put("/", asyncHandler(upsertResourceProvider))
  .get("/name/:name", asyncHandler(getResourceProviderByName))
  .get("/name/:name/resources", asyncHandler(getResourceProviderResources))
  .put("/:providerId/set", asyncHandler(setResourceProviderResources));
