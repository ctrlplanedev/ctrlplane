import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type * as PB from "../../workspace-engine/types/index.js";
import type { FullResource } from "../events.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getFullResource = async (resource: schema.Resource) => {
  const metadataResult = await db
    .select()
    .from(schema.resourceMetadata)
    .where(eq(schema.resourceMetadata.resourceId, resource.id));
  const metadata = Object.fromEntries(
    metadataResult.map((m) => [m.key, m.value]),
  );
  return { ...resource, metadata };
};

const getPbResource = (resource: FullResource): PB.Resource => ({
  id: resource.id,
  name: resource.name,
  version: resource.version,
  kind: resource.kind,
  identifier: resource.identifier,
  workspaceId: resource.workspaceId,
  createdAt: resource.createdAt.toISOString(),
  providerId: resource.providerId ?? undefined,
  lockedAt: resource.lockedAt?.toISOString() ?? undefined,
  updatedAt: resource.updatedAt?.toISOString() ?? undefined,
  deletedAt: resource.deletedAt?.toISOString() ?? undefined,
  metadata: resource.metadata,
  variables: {},
});

const convertFullResourceToNodeEvent = (fullResource: FullResource) => ({
  workspaceId: fullResource.workspaceId,
  eventType: Event.ResourceCreated,
  eventId: fullResource.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: fullResource,
});

const convertFullResourceToGoEvent = (fullResource: FullResource) => ({
  workspaceId: fullResource.workspaceId,
  eventType: Event.ResourceCreated as const,
  data: getPbResource(fullResource),
  timestamp: Date.now(),
});

export const dispatchResourceCreated = (
  resource: schema.Resource,
  _?: "api" | "scheduler" | "user-action",
) =>
  getFullResource(resource).then((fullResource) =>
    Promise.all([
      sendNodeEvent(convertFullResourceToNodeEvent(fullResource)),
      sendGoEvent(convertFullResourceToGoEvent(fullResource)),
    ]),
  );

export const dispatchResourceUpdated = async (
  previous: schema.Resource,
  current: schema.Resource,
  source?: "api" | "scheduler" | "user-action",
) => {
  const [previousFullResource, currentFullResource] = await Promise.all([
    getFullResource(previous),
    getFullResource(current),
  ]);

  await Promise.all([
    sendNodeEvent({
      workspaceId: current.workspaceId,
      eventType: Event.ResourceUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: source ?? "api",
      payload: { previous: previousFullResource, current: currentFullResource },
    }),
    sendGoEvent(convertFullResourceToGoEvent(currentFullResource)),
  ]);
};

export const dispatchResourceDeleted = (
  resource: schema.Resource,
  _?: "api" | "scheduler" | "user-action",
) =>
  getFullResource(resource).then((fullResource) =>
    Promise.all([
      sendNodeEvent(convertFullResourceToNodeEvent(fullResource)),
      sendGoEvent(convertFullResourceToGoEvent(fullResource)),
    ]),
  );

export const getWorkspaceIdForResource = async (resourceId: string) =>
  db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.id, resourceId))
    .then(takeFirst)
    .then((row) => row.workspaceId);

export const dispatchResourceVariableCreated = async (
  resourceVariable: typeof schema.resourceVariable.$inferSelect,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForResource(
    resourceVariable.resourceId,
  );
  await sendNodeEvent({
    workspaceId,
    eventType: Event.ResourceVariableCreated,
    eventId: resourceVariable.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: resourceVariable,
  });
};

export const dispatchResourceVariableUpdated = async (
  previous: typeof schema.resourceVariable.$inferSelect,
  current: typeof schema.resourceVariable.$inferSelect,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForResource(current.resourceId);
  await sendNodeEvent({
    workspaceId,
    eventType: Event.ResourceVariableUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
};

export const dispatchResourceVariableDeleted = async (
  resourceVariable: typeof schema.resourceVariable.$inferSelect,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForResource(
    resourceVariable.resourceId,
  );
  await sendNodeEvent({
    workspaceId,
    eventType: Event.ResourceVariableDeleted,
    eventId: resourceVariable.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: resourceVariable,
  });
};
