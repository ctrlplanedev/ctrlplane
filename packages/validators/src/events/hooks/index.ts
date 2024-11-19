import { z } from "zod";

import type { RunbookVariable } from "./runbook-variable.js";
import { resourceRemoved, ResourceRemovedVariables } from "./target.js";

export * from "./target.js";

export const hookEvent = resourceRemoved;
export type HookEvent = z.infer<typeof hookEvent>;

// action
export const hookActionsList = ["deployment.resource.removed"];
export const hookActions = z.enum(hookActionsList as [string, ...string[]]);

export enum HookAction {
  DeploymentResourceRemoved = "deployment.resource.removed",
}

export const RunhookVariables: Record<HookAction, Array<RunbookVariable>> = {
  [HookAction.DeploymentResourceRemoved]: ResourceRemovedVariables,
};
