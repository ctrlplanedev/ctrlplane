import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { FullResource, Message } from "../events.js";
import { createSpanWrapper } from "../../span.js";
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

const getOapiResource = (
  resource: FullResource,
): WorkspaceEngine["schemas"]["Resource"] => ({
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
  config: resource.config,
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
  data: getOapiResource(fullResource),
  timestamp: Date.now(),
});

export const dispatchResourceCreated = async (resource: schema.Resource) => {
  const fullResource = await getFullResource(resource);
  const nodeEvent = convertFullResourceToNodeEvent(fullResource);
  const goEvent = convertFullResourceToGoEvent(fullResource);
  await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
};

export const dispatchResourceUpdated = createSpanWrapper(
  "dispatchResourceUpdated",
  async (span: Span, previous: schema.Resource, current: schema.Resource) => {
    span.setAttribute("resource.id", current.id);
    span.setAttribute("resource.name", current.name);
    span.setAttribute("workspace.id", current.workspaceId);

    const [previousFullResource, currentFullResource] = await Promise.all([
      getFullResource(previous),
      getFullResource(current),
    ]);
    const nodeEvent: Message<Event.ResourceUpdated> = {
      workspaceId: current.workspaceId,
      eventType: Event.ResourceUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api" as const,
      payload: { previous: previousFullResource, current: currentFullResource },
    };
    const goEvent = convertFullResourceToGoEvent(currentFullResource);
    await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
  },
);

// export const dispatchResourceUpdated = async (
//   previous: schema.Resource,
//   current: schema.Resource,
//   source?: "api" | "scheduler" | "user-action",
// ) => {
//   const [previousFullResource, currentFullResource] = await Promise.all([
//     getFullResource(previous),
//     getFullResource(current),
//   ]);

//   const nodeEvent = {
//     workspaceId: current.workspaceId,
//     eventType: Event.ResourceUpdated,
//     eventId: current.id,
//     timestamp: Date.now(),
//     source: source ?? "api",
//     payload: { previous: previousFullResource, current: currentFullResource },
//   };

//   const goEvent = convertFullResourceToGoEvent(currentFullResource);

//   await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
// };

export const dispatchResourceDeleted = async (resource: schema.Resource) => {
  const fullResource = await getFullResource(resource);
  const nodeEvent = convertFullResourceToNodeEvent(fullResource);
  const goEvent = convertFullResourceToGoEvent(fullResource);
  await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
};

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
