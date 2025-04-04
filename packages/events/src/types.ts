import type * as schema from "@ctrlplane/db/schema";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",

  ReleaseNewVersion = "release-new-version",
  ReleaseNewRepository = "release-new-repository",
  ReleaseVariableChange = "release-variable-change",

  NewDeployment = "new-deployment",
  NewDeploymentVersion = "new-deployment-version",
  NewEnvironment = "new-environment",
  NewRelease = "new-release",
  ReleaseEvaluate = "release-evaluate",
}

export type ReleaseEvaluateJobData = {
  environmentId: string;
  resourceId: string;
  deploymentId: string;
};

export type ChannelMap = {
  [Channel.NewDeployment]: schema.Deployment;
  [Channel.NewDeploymentVersion]: schema.DeploymentVersion;
  [Channel.NewEnvironment]: typeof schema.environment.$inferSelect;
  [Channel.ReleaseEvaluate]: ReleaseEvaluateJobData;
  [Channel.DispatchJob]: { jobId: string };
  [Channel.ResourceScan]: { resourceProviderId: string };
};
