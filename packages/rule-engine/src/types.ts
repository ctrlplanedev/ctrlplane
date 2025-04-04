import type * as schema from "@ctrlplane/db/schema";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import type { Releases } from "./releases.js";

export type ResolvedRelease = {
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
  resourceSelector?: ResourceCondition | null;
  versionSelector?: DeploymentVersionCondition | null;
};

export type Resource = {
  id: string;
  name: string;
};

export type Environment = {
  id: string;
  name: string;
  resourceSelector?: ResourceCondition | null;
};

export type DeploymentResourceContext = {
  desiredReleaseId: string | null;
  deployment: Deployment;
  environment: Environment;
  resource: Resource;
};

export type DeploymentResourceRuleResult = {
  allowedReleases: Releases;
  rejectionReasons?: Map<string, string>;
};

export type DeploymentResourceSelectionResult = {
  allowed: boolean;
  chosenRelease?: ResolvedRelease;
  rejectionReasons: Map<string, string>;
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

export type Policy = schema.Policy & {
  denyWindows: schema.PolicyRuleDenyWindow[];
  deploymentVersionSelector: schema.PolicyDeploymentVersionSelector | null;
};

export type ReleaseRepository = {
  deploymentId: string;
  environmentId: string;
  resourceId: string;
};

export type GetReleasesFunc = (
  ctx: DeploymentResourceContext,
  policy: Policy,
) => Promise<ResolvedRelease[]> | ResolvedRelease[];
