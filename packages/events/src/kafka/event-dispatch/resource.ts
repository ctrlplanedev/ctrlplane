import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchResourceCreated = (
  resource: schema.Resource,
  source?: "api" | "scheduler" | "user-action",
) =>
  sendEvent({
    workspaceId: resource.workspaceId,
    eventType: Event.ResourceCreated,
    eventId: resource.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: resource,
  });

export const dispatchResourceUpdated = (
  previous: schema.Resource,
  current: schema.Resource,
  source?: "api" | "scheduler" | "user-action",
) =>
  sendEvent({
    workspaceId: current.workspaceId,
    eventType: Event.ResourceUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });

export const dispatchResourceDeleted = (
  resource: schema.Resource,
  source?: "api" | "scheduler" | "user-action",
) =>
  sendEvent({
    workspaceId: resource.workspaceId,
    eventType: Event.ResourceDeleted,
    eventId: resource.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: resource,
  });

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
  await sendEvent({
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
  await sendEvent({
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
  await sendEvent({
    workspaceId,
    eventType: Event.ResourceVariableDeleted,
    eventId: resourceVariable.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: resourceVariable,
  });
};
