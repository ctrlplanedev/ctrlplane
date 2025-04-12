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
  NewRelease = "new-release",
  NewResource = "new-resource",

  UpdatedResource = "updated-resource",
  UpdateResourceVariable = "update-resource-variable",
  UpdateEnvironment = "update-environment",
  UpdateDeploymentVariable = "update-deployment-variable",

  DeleteDeployment = "delete-deployment",
  DeleteEnvironment = "delete-environment",
  DeleteResource = "delete-resource",

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
  [Channel.UpdateDeploymentVariable]: schema.DeploymentVariable;
  [Channel.UpdateResourceVariable]: schema.ResourceVariable;
  [Channel.NewEnvironment]: typeof schema.environment.$inferSelect;
  [Channel.UpdateEnvironment]: schema.Environment & {
    oldSelector: ResourceCondition | null;
  };

  [Channel.EvaluateReleaseTarget]: EvaluateReleaseTargetJob;
  [Channel.DispatchJob]: { jobId: string };
  [Channel.ResourceScan]: { resourceProviderId: string };
  [Channel.UpdatedResource]: schema.Resource;
  [Channel.NewResource]: schema.Resource;
};
