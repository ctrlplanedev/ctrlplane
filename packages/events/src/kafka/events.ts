import type * as schema from "@ctrlplane/db/schema";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import type * as PB from "../workspace-engine/types/index.js";

export enum Event {
  SystemCreated = "system.created",
  SystemUpdated = "system.updated",
  SystemDeleted = "system.deleted",

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

  JobAgentCreated = "job-agent.created",
  JobAgentUpdated = "job-agent.updated",
  JobAgentDeleted = "job-agent.deleted",

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

  UserApprovalRecordCreated = "user-approval-record.created",
  UserApprovalRecordUpdated = "user-approval-record.updated",
  UserApprovalRecordDeleted = "user-approval-record.deleted",

  GithubEntityCreated = "github-entity.created",
  GithubEntityUpdated = "github-entity.updated",
  GithubEntityDeleted = "github-entity.deleted",

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

export type FullResource = schema.Resource & {
  metadata: Record<string, string>;
};

export type FullReleaseTarget = schema.ReleaseTarget & {
  resource: FullResource;
  environment: schema.Environment;
  deployment: schema.Deployment;
};

export type EventPayload = {
  [Event.ResourceCreated]: FullResource;
  [Event.ResourceUpdated]: {
    previous: FullResource;
    current: FullResource;
  };
  [Event.ResourceDeleted]: FullResource;
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
  [Event.JobAgentCreated]: schema.JobAgent;
  [Event.JobAgentUpdated]: schema.JobAgent;
  [Event.JobAgentDeleted]: schema.JobAgent;
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
  [Event.EvaluateReleaseTarget]: {
    releaseTarget: FullReleaseTarget;
    opts?: { skipDuplicateCheck?: boolean };
  };
  [Event.UserApprovalRecordCreated]: schema.PolicyRuleAnyApprovalRecord;
  [Event.UserApprovalRecordUpdated]: schema.PolicyRuleAnyApprovalRecord;
  [Event.UserApprovalRecordDeleted]: schema.PolicyRuleAnyApprovalRecord;
  [Event.GithubEntityCreated]: schema.GithubEntity;
  [Event.GithubEntityUpdated]: schema.GithubEntity;
  [Event.GithubEntityDeleted]: schema.GithubEntity;
  [Event.SystemCreated]: schema.System;
  [Event.SystemUpdated]: schema.System;
  [Event.SystemDeleted]: schema.System;
  // [Event.JobCreated]: schema.Job;
  // [Event.JobDeleted]: schema.Job;
  // [Event.SystemCreated]: schema.System;
  // [Event.SystemUpdated]: { previous: schema.System; current: schema.System };
  // [Event.SystemDeleted]: schema.System;
};

export type GoEventPayload = {
  [Event.SystemCreated]: WorkspaceEngine["schemas"]["System"];
  [Event.SystemUpdated]: WorkspaceEngine["schemas"]["System"];
  [Event.SystemDeleted]: WorkspaceEngine["schemas"]["System"];
  [Event.ResourceCreated]: WorkspaceEngine["schemas"]["Resource"];
  [Event.ResourceUpdated]: WorkspaceEngine["schemas"]["Resource"];
  [Event.ResourceDeleted]: WorkspaceEngine["schemas"]["Resource"];
  [Event.DeploymentCreated]: WorkspaceEngine["schemas"]["Deployment"];
  [Event.DeploymentUpdated]: WorkspaceEngine["schemas"]["Deployment"];
  [Event.DeploymentDeleted]: WorkspaceEngine["schemas"]["Deployment"];
  [Event.DeploymentVariableCreated]: WorkspaceEngine["schemas"]["DeploymentVariable"];
  [Event.DeploymentVariableUpdated]: WorkspaceEngine["schemas"]["DeploymentVariable"];
  [Event.DeploymentVariableDeleted]: WorkspaceEngine["schemas"]["DeploymentVariable"];
  [Event.DeploymentVariableValueCreated]: PB.DeploymentVariableValue;
  [Event.DeploymentVariableValueUpdated]: PB.DeploymentVariableValue;
  [Event.DeploymentVariableValueDeleted]: PB.DeploymentVariableValue;
  [Event.DeploymentVersionCreated]: WorkspaceEngine["schemas"]["DeploymentVersion"];
  [Event.DeploymentVersionUpdated]: WorkspaceEngine["schemas"]["DeploymentVersion"];
  [Event.DeploymentVersionDeleted]: WorkspaceEngine["schemas"]["DeploymentVersion"];
  [Event.JobAgentCreated]: WorkspaceEngine["schemas"]["JobAgent"];
  [Event.JobAgentUpdated]: WorkspaceEngine["schemas"]["JobAgent"];
  [Event.JobAgentDeleted]: WorkspaceEngine["schemas"]["JobAgent"];
  [Event.EnvironmentCreated]: WorkspaceEngine["schemas"]["Environment"];
  [Event.EnvironmentUpdated]: WorkspaceEngine["schemas"]["Environment"];
  [Event.EnvironmentDeleted]: WorkspaceEngine["schemas"]["Environment"];
  [Event.PolicyCreated]: WorkspaceEngine["schemas"]["Policy"];
  [Event.PolicyUpdated]: WorkspaceEngine["schemas"]["Policy"];
  [Event.PolicyDeleted]: WorkspaceEngine["schemas"]["Policy"];
  [Event.JobUpdated]: WorkspaceEngine["schemas"]["JobUpdateEvent"];
  [Event.UserApprovalRecordCreated]: WorkspaceEngine["schemas"]["UserApprovalRecord"];
  [Event.UserApprovalRecordUpdated]: WorkspaceEngine["schemas"]["UserApprovalRecord"];
  [Event.UserApprovalRecordDeleted]: WorkspaceEngine["schemas"]["UserApprovalRecord"];
  [Event.GithubEntityCreated]: WorkspaceEngine["schemas"]["GithubEntity"];
  [Event.GithubEntityUpdated]: WorkspaceEngine["schemas"]["GithubEntity"];
  [Event.GithubEntityDeleted]: WorkspaceEngine["schemas"]["GithubEntity"];
};

export type Message<T extends keyof EventPayload> = {
  workspaceId: string;
  eventType: T;
  eventId: string;
  timestamp: number;
  source: "api" | "scheduler" | "user-action";
  payload: EventPayload[T];
};

export type GoMessage<T extends keyof GoEventPayload> = {
  workspaceId: string;
  eventType: T;
  data: GoEventPayload[T];
  timestamp: number;
};
