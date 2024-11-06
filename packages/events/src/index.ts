import type { HookEvent } from "@ctrlplane/validators/events";

import { isEnvironmentDeletedEvent } from "@ctrlplane/validators/events";

import { handleEnvironmentDeleted } from "./environments/environment-delete.js";

export const handleHookEvent = (event: HookEvent): Promise<void> => {
  if (isEnvironmentDeletedEvent(event)) handleEnvironmentDeleted(event);
  throw new Error(`Unknown event type: ${event.type}`);
};
