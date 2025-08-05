import type * as schema from "@ctrlplane/db/schema";

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
