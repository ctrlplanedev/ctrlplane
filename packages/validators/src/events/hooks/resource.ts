import { z } from "zod";

import type { RunbookVariable } from "./runbook-variable";

const deployment = z.object({ id: z.string().uuid(), name: z.string() });
const resource = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  config: z.record(z.any()),
});

export const resourceRemoved = z.object({
  action: z.literal("deployment.resource.removed"),
  payload: z.object({ deployment, resource }),
});
export type ResourceRemoved = z.infer<typeof resourceRemoved>;

const resourceVar: RunbookVariable = {
  key: "resourceId",
  name: "Resource Id",
  config: { type: "resource" },
};

const deploymentVar: RunbookVariable = {
  key: "deploymentId",
  name: "Deployment Id",
  config: { type: "deployment" },
};

export const DeploymentResourceRemovedVariables = [resourceVar, deploymentVar];
