import type * as schema from "@ctrlplane/db/schema";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",

  ReleaseNewVersion = "release-new-version",
  ReleaseNewRepository = "release-new-repository",
  ReleaseVariableChange = "release-variable-change",

  NewDeployment = "new-deployment",
  NewEnvironment = "new-environment",
  NewRelease = "new-release",
  ReleaseEvaluate = "release-evaluate",

  PolicyEvaluate = "policy-evaluate",
  NewDeploymentVersion = "new-deployment-version",
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
};
