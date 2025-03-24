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
  resourceSelector?: object;
  versionSelector?: object;
};

export type Resource = {
  id: string;
  name: string;
};

export type Environment = {
  id: string;
  name: string;
  resourceSelector?: object;
};

export type DeploymentResourceContext = {
  desiredReleaseId: string;
  deployment: Deployment;
  environment: Environment;
  resource: Resource;
  availableReleases: Release[];
};

/**
 * After a single rule filters versions, it yields this result.
 */
export type DeploymentResourceRuleResult = {
  allowedReleases: Release[];
  reason?: string;
};

export type DeploymentResourceSelectionResult = {
  allowed: boolean;
  chosenRelease?: Release;
  reason?: string;
};

/**
 * A rule to filter/reorder the candidate versions.
 */
export interface DeploymentResourceRule {
  name: string;
  filter(
    context: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourceRuleResult | Promise<DeploymentResourceRuleResult>;
}
