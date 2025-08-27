import type { EventPayload, Message } from "@ctrlplane/events";

import { Event } from "@ctrlplane/events";

import { deletedResource, newResource, updatedResource } from "./resources.js";

const handlers: Record<Event, Handler<any>> = {
  [Event.ResourceCreated]: newResource,
  [Event.ResourceUpdated]: updatedResource,
  [Event.ResourceDeleted]: deletedResource,
};

export type Handler<T extends keyof EventPayload> = (
  event: Message<T>,
) => Promise<void> | void;

export const getHandler = <T extends keyof EventPayload = any>(
  event: T,
): Handler<T> => {
  return handlers[event];
};
