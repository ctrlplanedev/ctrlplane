import type * as schema from "@ctrlplane/db/schema";
import type {
  ReleaseTargetIdentifier,
  VersionEvaluateOptions,
} from "@ctrlplane/rule-engine";
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
  UpdateJob = "update-job",

  DeleteDeployment = "delete-deployment",
  DeleteEnvironment = "delete-environment",
  DeleteResource = "delete-resource",
  DeletedReleaseTarget = "deleted-release-target", // NOTE: handles post-processing for already deleted release targets

  EvaluateReleaseTarget = "evaluate-release-target",

  ComputeSystemsReleaseTargets = "compute-systems-release-targets",
  ComputeEnvironmentResourceSelector = "compute-environment-resource-selector",
  ComputeDeploymentResourceSelector = "compute-deployment-resource-selector",
  ComputeWorkspacePolicyTargets = "compute-workspace-policy-targets",
  ComputePolicyTargetReleaseTargetSelector = "compute-policy-target-release-target-selector",
}

export type EvaluateReleaseTargetJob = {
  environmentId: string;
  resourceId: string;
  deploymentId: string;
  skipDuplicateCheck?: boolean;
  versionEvaluateOptions?: VersionEvaluateOptions;
};

export type ChannelMap = {
  [Channel.NewDeployment]: schema.Deployment;
  [Channel.NewDeploymentVersion]: schema.DeploymentVersion;
  [Channel.NewEnvironment]: typeof schema.environment.$inferSelect;
  [Channel.NewResource]: schema.Resource;
  [Channel.NewPolicy]: schema.Policy;

  [Channel.UpdateDeploymentVariable]: schema.DeploymentVariable;
  [Channel.UpdateResourceVariable]: typeof schema.resourceVariable.$inferSelect;
  [Channel.UpdateEnvironment]: schema.Environment & {
    oldSelector: ResourceCondition | null;
  };
  [Channel.UpdateDeployment]: {
    new: schema.Deployment;
    old: schema.Deployment;
  };
  [Channel.UpdatedResource]: schema.Resource;
  [Channel.UpdatePolicy]: schema.Policy;
  [Channel.UpdateJob]: {
    jobId: string;
    data: schema.UpdateJob;
    metadata?: Record<string, any>;
  };

  [Channel.DeleteDeployment]: { id: string };
  [Channel.DeleteEnvironment]: { id: string };
  [Channel.DeleteResource]: schema.Resource;
  [Channel.DeletedReleaseTarget]: schema.ReleaseTarget;

  [Channel.EvaluateReleaseTarget]: EvaluateReleaseTargetJob;
  [Channel.DispatchJob]: { jobId: string };
  [Channel.ResourceScan]: { resourceProviderId: string };

  [Channel.ComputeEnvironmentResourceSelector]: { id: string };
  [Channel.ComputeDeploymentResourceSelector]: { id: string };
  [Channel.ComputePolicyTargetReleaseTargetSelector]: { id: string };
  [Channel.ComputeWorkspacePolicyTargets]: {
    workspaceId: string;
    releaseTargetsToEvaluate?: ReleaseTargetIdentifier[];
  };
  [Channel.ComputeSystemsReleaseTargets]: { id: string };
};
