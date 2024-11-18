import { z } from "zod";

import type { ResourceRemoved } from "./target.js";
import { resourceRemoved } from "./target.js";

export * from "./target.js";

export const hookEvent = resourceRemoved;
export type HookEvent = z.infer<typeof hookEvent>;

// typeguards
export const isResourceRemoved = (event: HookEvent): event is ResourceRemoved =>
  true;

// action
export const hookActionsList = ["deployment.resource.removed"];
export const hookActions = z.enum(hookActionsList as [string, ...string[]]);
