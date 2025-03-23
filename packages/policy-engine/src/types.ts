export type Release = {
  id: string;
  createdAt: Date;
  version: {
    tag: string;
    config: string;
    metadata: Record<string, string>;
    statusHistory: Record<string, string>;
  };
  variables: Record<string, unknown>;
};

export type Deployment = {
  id: string;
  name: string;
};

export type Resource = {
  id: string;
  name: string;
};

export type DeploymentResourceContext = {
  desiredReleaseId: string;
  deployment: Deployment;
  resource: Resource;
  availableReleases: Release[];
};

/**
 * After a single policy filters versions, it yields this result.
 */
export type DeploymentResourcePolicyResult = {
  allowedReleases: Release[];
  reason?: string;
};

export type DeploymentResourceSelectionResult = {
  allowed: boolean;
  chosenRelease?: Release;
  reason?: string;
};

/**
 * A policy to filter/reorder the candidate versions.
 */
export interface DeploymentResourcePolicy {
  name: string;
  filter(
    context: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourcePolicyResult | Promise<DeploymentResourcePolicyResult>;
}
