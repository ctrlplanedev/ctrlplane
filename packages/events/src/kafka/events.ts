import type * as schema from "@ctrlplane/db/schema";

export enum Event {
  ResourceCreated = "resource.created",
  ResourceUpdated = "resource.updated",
  ResourceDeleted = "resource.deleted",

  ResourceVariableCreated = "resource-variable.created",
  ResourceVariableUpdated = "resource-variable.updated",
  ResourceVariableDeleted = "resource-variable.deleted",

  DeploymentCreated = "deployment.created",
  DeploymentUpdated = "deployment.updated",
  DeploymentDeleted = "deployment.deleted",

  DeploymentVariableCreated = "deployment-variable.created",
  DeploymentVariableUpdated = "deployment-variable.updated",
  DeploymentVariableDeleted = "deployment-variable.deleted",

  DeploymentVariableValueCreated = "deployment-variable-value.created",
  DeploymentVariableValueUpdated = "deployment-variable-value.updated",
  DeploymentVariableValueDeleted = "deployment-variable-value.deleted",

  DeploymentVersionCreated = "deployment-version.created",
  DeploymentVersionUpdated = "deployment-version.updated",
  DeploymentVersionDeleted = "deployment-version.deleted",

  EnvironmentCreated = "environment.created",
  EnvironmentUpdated = "environment.updated",
  EnvironmentDeleted = "environment.deleted",

  PolicyCreated = "policy.created",
  PolicyUpdated = "policy.updated",
  PolicyDeleted = "policy.deleted",

  // JobCreated = "job.created",
  JobUpdated = "job.updated",
  // JobDeleted = "job.deleted",
  EvaluateReleaseTarget = "evaluate-release-target",

  // ReleaseCreated = "release.created",
  // ReleaseUpdated = "release.updated",
  // ReleaseDeleted = "release.deleted",

  // SystemCreated = "system.created",
  // SystemUpdated = "system.updated",
  // SystemDeleted = "system.deleted",
}

export type FullPolicy = schema.Policy & {
  targets: schema.PolicyTarget[];
  denyWindows: schema.PolicyRuleDenyWindow[];
  deploymentVersionSelector: schema.PolicyDeploymentVersionSelector | null;
  versionAnyApprovals: schema.PolicyRuleAnyApproval | null;
  versionUserApprovals: schema.PolicyRuleUserApproval[];
  versionRoleApprovals: schema.PolicyRuleRoleApproval[];
  concurrency: schema.PolicyRuleConcurrency | null;
  environmentVersionRollout: schema.PolicyRuleEnvironmentVersionRollout | null;
  maxRetries: schema.PolicyRuleMaxRetries | null;
};

export type EventPayload = {
  [Event.ResourceCreated]: schema.Resource;
  [Event.ResourceUpdated]: {
    previous: schema.Resource;
    current: schema.Resource;
  };
  [Event.ResourceDeleted]: schema.Resource;
  [Event.ResourceVariableCreated]: typeof schema.resourceVariable.$inferSelect;
  [Event.ResourceVariableUpdated]: {
    previous: typeof schema.resourceVariable.$inferSelect;
    current: typeof schema.resourceVariable.$inferSelect;
  };
  [Event.ResourceVariableDeleted]: typeof schema.resourceVariable.$inferSelect;
  [Event.DeploymentCreated]: schema.Deployment;
  [Event.DeploymentUpdated]: {
    previous: schema.Deployment;
    current: schema.Deployment;
  };
  [Event.DeploymentDeleted]: schema.Deployment;
  [Event.DeploymentVariableCreated]: schema.DeploymentVariable;
  [Event.DeploymentVariableUpdated]: {
    previous: schema.DeploymentVariable;
    current: schema.DeploymentVariable;
  };
  [Event.DeploymentVariableDeleted]: schema.DeploymentVariable;
  [Event.DeploymentVariableValueCreated]: schema.DeploymentVariableValue;
  [Event.DeploymentVariableValueUpdated]: {
    previous: schema.DeploymentVariableValue;
    current: schema.DeploymentVariableValue;
  };
  [Event.DeploymentVariableValueDeleted]: schema.DeploymentVariableValue;
  [Event.DeploymentVersionCreated]: schema.DeploymentVersion;
  [Event.DeploymentVersionUpdated]: {
    previous: schema.DeploymentVersion;
    current: schema.DeploymentVersion;
  };
  [Event.DeploymentVersionDeleted]: schema.DeploymentVersion;
  [Event.EnvironmentCreated]: schema.Environment;
  [Event.EnvironmentUpdated]: {
    previous: schema.Environment;
    current: schema.Environment;
  };
  [Event.EnvironmentDeleted]: schema.Environment;
  [Event.PolicyCreated]: FullPolicy;
  [Event.PolicyUpdated]: { previous: FullPolicy; current: FullPolicy };
  [Event.PolicyDeleted]: FullPolicy;
  [Event.JobUpdated]: { previous: schema.Job; current: schema.Job };
  [Event.EvaluateReleaseTarget]: schema.ReleaseTarget;
  // [Event.JobCreated]: schema.Job;
  // [Event.JobDeleted]: schema.Job;
  // [Event.SystemCreated]: schema.System;
  // [Event.SystemUpdated]: { previous: schema.System; current: schema.System };
  // [Event.SystemDeleted]: schema.System;
};

export type Message<T extends keyof EventPayload> = {
  workspaceId: string;
  eventType: T;
  eventId: string;
  timestamp: number;
  source: "api" | "scheduler" | "user-action";
  payload: EventPayload[T];
};
