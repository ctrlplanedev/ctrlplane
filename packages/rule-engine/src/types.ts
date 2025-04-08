import type * as schema from "@ctrlplane/db/schema";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

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

export type RuleEngineContext = {
  desiredReleaseId: string | null;
  deployment: Deployment;
  environment: Environment;
  resource: Resource;
};

export type RuleEngineRuleResult<T> = {
  allowedCandidates: T[];
  rejectionReasons?: Map<string, string>;
};

export type RuleEngineSelectionResult<T> = {
  chosenCandidate: T | null;
  rejectionReasons: Map<string, string>;
};

/**
 * A rule to filter/reorder the candidate versions.
 */
export interface RuleEngineFilter<T> {
  name: string;
  filter(
    context: RuleEngineContext,
    candidates: T[],
  ): RuleEngineRuleResult<T> | Promise<RuleEngineRuleResult<T>>;
}

export type Policy = schema.Policy & {
  denyWindows: schema.PolicyRuleDenyWindow[];
  deploymentVersionSelector: schema.PolicyDeploymentVersionSelector | null;
  versionAnyApprovals: schema.PolicyRuleAnyApproval[];
  versionUserApprovals: schema.PolicyRuleUserApproval[];
  versionRoleApprovals: schema.PolicyRuleRoleApproval[];
};

export type ReleaseTargetIdentifier = {
  deploymentId: string;
  environmentId: string;
  resourceId: string;
};

export type GetReleasesFunc = (
  ctx: RuleEngineContext,
  policy: Policy,
) => Promise<ResolvedRelease[]> | ResolvedRelease[];

export type RuleEngine<T> = {
  evaluate: (
    context: RuleEngineContext,
    candidates: T[],
  ) => Promise<RuleEngineSelectionResult<T>>;
};
