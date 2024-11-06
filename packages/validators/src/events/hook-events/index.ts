import { z } from "zod";

import type {
  EnvironmentCreatedEvent,
  EnvironmentDeletedEvent,
} from "./environment.js";
import {
  environmentCreatedEvent,
  environmentDeletedEvent,
  EnvironmentEvent,
} from "./environment.js";

export * from "./environment.js";

export const HookEvent = z.union([
  environmentDeletedEvent,
  environmentCreatedEvent,
]);
export type HookEvent = z.infer<typeof HookEvent>;

// typeguards
export const isEnvironmentDeletedEvent = (
  event: HookEvent,
): event is EnvironmentDeletedEvent => event.type === EnvironmentEvent.Deleted;
export const isEnvironmentCreatedEvent = (
  event: HookEvent,
): event is EnvironmentCreatedEvent => event.type === EnvironmentEvent.Created;
