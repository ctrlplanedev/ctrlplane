import type { Releases } from "./releases.js";

export type Release = {
  id: string;
  createdAt: Date;
  version: {
    id: string;
    tag: string;
    config: Record<string, any>;
    metadata: Record<string, string>;
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
  desiredReleaseId: string | null;
  deployment: Deployment;
  environment: Environment;
  resource: Resource;
};

/**
 * After a single rule filters versions, it yields this result.
 */
export type DeploymentResourceRuleResult = {
  allowedReleases: Releases;
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
    releases: Releases,
  ): DeploymentResourceRuleResult | Promise<DeploymentResourceRuleResult>;
}
