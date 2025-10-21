import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

// Shared types for deployment components
export type DeploymentVersionStatus =
  | "unspecified"
  | "building"
  | "ready"
  | "failed"
  | "rejected";

export type JobStatus =
  | "cancelled"
  | "skipped"
  | "inProgress"
  | "actionRequired"
  | "pending"
  | "failure"
  | "invalidJobAgent"
  | "invalidIntegration"
  | "externalRunNotFound"
  | "successful";

export type DeploymentVersion = {
  id: string;
  name: string;
  tag: string;
  status: DeploymentVersionStatus;
  createdAt: string;
  message?: string;
  releaseTargetCount: number;
  environmentCount: number;
  currentEnvironments: string[];
};

export type DeploymentDetail = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  systemId: string;
  systemName: string;
  environments: Environment[];
  versions: DeploymentVersion[];
  releaseTargets: ReleaseTarget[];
  stats: {
    totalReleases: number;
    totalResources: number;
    deploymentsLast24h: 48;
    successRate: number;
  };
};

export type Deployment = WorkspaceEngine["schemas"]["Deployment"];
export type Version = WorkspaceEngine["schemas"]["DeploymentVersion"] & {};
export type Resource = WorkspaceEngine["schemas"]["Resource"];

export type Environment = {
  id: string;
  name: string;
  description?: string;
  policies: string[];
  dependsOnEnvironmentIds: string[];
};

export type Job = {
  id: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type ReleaseTarget = {
  version: {
    currentId: string;
    desiredId: string; // Latest version that passes all policies
    blockedVersions?: Array<{
      versionId: string;
      reason: string; // e.g., "Approval required", "Environment progression rule", "Time window"
    }>;
  };
  environment: { id: string; name: string };
  resource: { id: string; name: string; kind: string; identifier: string };
  jobs: Job[];
};

export const rtid = (rt: ReleaseTarget) => {
  return `${rt.environment.id}-${rt.resource.id}`;
};
