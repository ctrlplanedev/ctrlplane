import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

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
  EnvironmentSelectorUpdate = "environment-selector-update",
  NewRelease = "new-release",

  EvaluateReleaseTarget = "evaluate-release-target",
}

export type EvaluateReleaseTargetJob = {
  environmentId: string;
  resourceId: string;
  deploymentId: string;
};

export type ChannelMap = {
  [Channel.NewDeployment]: schema.Deployment;
  [Channel.NewDeploymentVersion]: schema.DeploymentVersion;
  [Channel.NewEnvironment]: typeof schema.environment.$inferSelect;
  [Channel.EnvironmentSelectorUpdate]: schema.Environment & {
    oldSelector: ResourceCondition | null;
  };
  [Channel.EvaluateReleaseTarget]: EvaluateReleaseTargetJob;
  [Channel.DispatchJob]: { jobId: string };
  [Channel.ResourceScan]: { resourceProviderId: string };
};
