import type * as schema from "@ctrlplane/db/schema";

export enum Channel {
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",

  NewDeployment = "new-deployment",
  NewEnvironment = "new-environment",
  NewDeploymentVersion = "new-deployment-version",

  PolicyEvaluate = "policy-evaluate",
  UpdateDeploymentVariable = "update-deployment-variable",
  UpdateResourceVariable = "update-resource-variable",
}

export type PolicyEvaluateJobData = {
  environmentId: string;
  resourceId: string;
  deploymentId: string;
};

export type ChannelMap = {
  [Channel.ResourceScan]: { resourceProviderId: string };
  [Channel.NewDeploymentVersion]: typeof schema.deploymentVersion.$inferSelect;
  [Channel.NewDeployment]: typeof schema.deployment.$inferSelect;
  [Channel.PolicyEvaluate]: PolicyEvaluateJobData;
  [Channel.DispatchJob]: { jobId: string };
  [Channel.UpdateDeploymentVariable]: typeof schema.deploymentVariable.$inferSelect;
  [Channel.UpdateResourceVariable]: typeof schema.resourceVariable.$inferSelect;
};
