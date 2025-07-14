import type * as schema from "@ctrlplane/db/schema";

export type DeploymentVersionWithJob = schema.DeploymentVersion & {
  job: schema.Job & { links: Record<string, string> };
};

export type ReleaseTargetModuleInfo = schema.ReleaseTarget & {
  resource: schema.Resource;
  deployment: schema.Deployment & { system: schema.System };
  environment: schema.Environment;
  deploymentVersion: DeploymentVersionWithJob | null;
};
