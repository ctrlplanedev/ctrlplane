// Shared types for deployment components
export type DeploymentVersionStatus =
  | "unspecified"
  | "building"
  | "ready"
  | "failed"
  | "rejected"
  | "paused";

export type JobStatus =
  | "cancelled"
  | "skipped"
  | "in_progress"
  | "action_required"
  | "pending"
  | "failure"
  | "invalid_job_agent"
  | "invalid_integration"
  | "external_run_not_found"
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
  systemIds: string[];
  systemNames: string[];
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

export type Deployment = {
  id: string;
  name: string;
  description: string;
  workspaceId: string | null;
  resourceSelector: string | null;
  metadata: Record<string, string>;
};

export type Resource = {
  id: string;
  name: string;
  kind: string;
  identifier: string;
  version: string;
};

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
  state: {
    currentRelease: {
      version: { id: string };
    };
    desiredRelease: {
      version: { id: string };
    };
  };
  environment: { id: string; name: string };
  resource: { id: string; name: string; kind: string; identifier: string };
  jobs: Job[];
};

export type ReleaseTargetWithState = {
  releaseTarget: {
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  };
  resource: {
    id: string;
    name: string;
    identifier: string;
    kind: string;
    version: string;
    [key: string]: unknown;
  };
  environment: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  deployment?: Deployment;
  currentVersion?: {
    id: string;
    tag: string;
    name: string;
    [key: string]: unknown;
  } | null;
  desiredVersion?: {
    id: string;
    tag: string;
    name: string;
    [key: string]: unknown;
  } | null;
  latestJob?: {
    id: string;
    status: string;
    message?: string | null;
    createdAt: Date;
    completedAt?: Date | null;
    links?: Record<string, string>;
    verifications: Array<{
      id: string;
      jobId: string;
      metrics: Array<unknown>;
      message?: string;
    }>;
  } | null;
};

export const rtid = (rt: ReleaseTarget) => {
  return `${rt.environment.id}-${rt.resource.id}`;
};
