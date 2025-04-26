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
  NewPolicy = "new-policy",

  UpdatedResource = "updated-resource",
  UpdateResourceVariable = "update-resource-variable",
  UpdateEnvironment = "update-environment",
  UpdateDeployment = "update-deployment",
  UpdateDeploymentVariable = "update-deployment-variable",
  UpdatePolicy = "update-policy",

  DeleteDeployment = "delete-deployment",
  DeleteEnvironment = "delete-environment",
  DeleteResource = "delete-resource",

  EvaluateReleaseTarget = "evaluate-release-target",

  ComputeSystemsReleaseTargets = "compute-systems-release-targets",
  ComputeEnvironmentResourceSelector = "compute-environment-resource-selector",
  ComputeDeploymentResourceSelector = "compute-deployment-resource-selector",
  ComputePolicyTargetReleaseTargetSelector = "compute-policy-target-release-target-selector",
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
  [Channel.NewResource]: schema.Resource;
  [Channel.NewPolicy]: schema.Policy;

  [Channel.UpdateDeploymentVariable]: schema.DeploymentVariable;
  [Channel.UpdateResourceVariable]: schema.ResourceVariable;
  [Channel.UpdateEnvironment]: schema.Environment & {
    oldSelector: ResourceCondition | null;
  };
  [Channel.UpdateDeployment]: schema.Deployment & {
    oldSelector: ResourceCondition | null;
  };
  [Channel.UpdatedResource]: schema.Resource;
  [Channel.UpdatePolicy]: schema.Policy;

  [Channel.DeleteResource]: schema.Resource;

  [Channel.EvaluateReleaseTarget]: EvaluateReleaseTargetJob;
  [Channel.DispatchJob]: { jobId: string };
  [Channel.ResourceScan]: { resourceProviderId: string };

  [Channel.ComputeEnvironmentResourceSelector]: { id: string };
  [Channel.ComputeDeploymentResourceSelector]: { id: string };
  [Channel.ComputePolicyTargetReleaseTargetSelector]: { id: string };
  [Channel.ComputeSystemsReleaseTargets]: { id: string };
};
