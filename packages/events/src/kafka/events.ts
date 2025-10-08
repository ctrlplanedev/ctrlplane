import type * as schema from "@ctrlplane/db/schema";

import type * as pb from "../workspace-engine/gen/workspace_pb.js";

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
  // [Event.JobCreated]: schema.Job;
  // [Event.JobDeleted]: schema.Job;
  // [Event.SystemCreated]: schema.System;
  // [Event.SystemUpdated]: { previous: schema.System; current: schema.System };
  // [Event.SystemDeleted]: schema.System;
};

// Remove the typescript-specific $typeName field from the protobuf objects
// go complains about the $typeName field being unknown
type Without$typeName<T> = Omit<T, "$typeName">;

type PbSelector = { json?: Record<string, any> };
type WithSelector<T, K extends keyof T> = Without$typeName<Omit<T, K>> &
  Partial<Record<K, PbSelector>>;

export type PbResource = Without$typeName<pb.Resource>;
export type PbDeployment = WithSelector<pb.Deployment, "resourceSelector">;
export type PbDeploymentVariable = Without$typeName<pb.DeploymentVariable>;
export type PbDeploymentVariableValue =
  Without$typeName<pb.DeploymentVariableValue>;
export type PbDeploymentVersion = Without$typeName<pb.DeploymentVersion>;
export type PbEnvironment = WithSelector<pb.Environment, "resourceSelector">;
export type PbPolicy = Without$typeName<pb.Policy>;
export type PbJob = Without$typeName<pb.Job>;

export type GoEventPayload = {
  [Event.ResourceCreated]: PbResource;
  [Event.ResourceUpdated]: PbResource;
  [Event.ResourceDeleted]: PbResource;
  [Event.DeploymentCreated]: PbDeployment;
  [Event.DeploymentUpdated]: PbDeployment;
  [Event.DeploymentDeleted]: PbDeployment;
  [Event.DeploymentVariableCreated]: PbDeploymentVariable;
  [Event.DeploymentVariableUpdated]: PbDeploymentVariable;
  [Event.DeploymentVariableDeleted]: pb.DeploymentVariable;
  [Event.DeploymentVariableValueCreated]: PbDeploymentVariableValue;
  [Event.DeploymentVariableValueUpdated]: pb.DeploymentVariableValue;
  [Event.DeploymentVariableValueDeleted]: PbDeploymentVariableValue;
  [Event.DeploymentVersionCreated]: PbDeploymentVersion;
  [Event.DeploymentVersionUpdated]: PbDeploymentVersion;
  [Event.DeploymentVersionDeleted]: PbDeploymentVersion;
  [Event.EnvironmentCreated]: PbEnvironment;
  [Event.EnvironmentUpdated]: PbEnvironment;
  [Event.EnvironmentDeleted]: PbEnvironment;
  [Event.PolicyCreated]: PbPolicy;
  [Event.PolicyUpdated]: PbPolicy;
  [Event.PolicyDeleted]: PbPolicy;
  [Event.JobUpdated]: PbJob;
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

// Helper function to wrap a selector in the protobuf format
export function wrapSelector<T extends Record<string, any> | null | undefined>(
  selector: T,
): PbSelector | undefined {
  if (selector == null) return undefined;
  return { json: selector };
}
