import { z } from "zod";

import type { RunbookVariable } from "./runbook-variable.js";
import {
  DeploymentResourceRemovedVariables,
  resourceRemoved,
} from "./resource.js";

export * from "./resource.js";

export const hookEvent = resourceRemoved;
export type HookEvent = z.infer<typeof hookEvent>;

export enum HookAction {
  DeploymentResourceRemoved = "deployment.resource.removed",
}

export const hookActionsList = Object.values(HookAction);
export const hookActions = z.nativeEnum(HookAction);

export const RunhookVariables: Record<HookAction, Array<RunbookVariable>> = {
  [HookAction.DeploymentResourceRemoved]: DeploymentResourceRemovedVariables,
};
