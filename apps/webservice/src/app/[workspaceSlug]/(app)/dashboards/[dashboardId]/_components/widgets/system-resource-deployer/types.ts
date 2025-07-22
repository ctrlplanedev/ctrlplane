import type * as schema from "@ctrlplane/db/schema";
import { z } from "zod";

export const systemResourceDeploymentsConfig = z.object({
  systemId: z.string().uuid(),
  resourceId: z.string().uuid(),
});

export type SystemResourceDeploymentsConfig = z.infer<
  typeof systemResourceDeploymentsConfig
>;

export const getIsValidConfig = (config: any) => {
  const parsedConfig = systemResourceDeploymentsConfig.safeParse(config);
  return parsedConfig.success;
};

export type Version = schema.DeploymentVersion & {
  job: schema.Job & { metadata: Record<string, string> };
};

export type ReleaseTarget = schema.ReleaseTarget & {
  version: Version | null;
};

export type Deployment = schema.Deployment & {
  releaseTarget: ReleaseTarget | null;
};
