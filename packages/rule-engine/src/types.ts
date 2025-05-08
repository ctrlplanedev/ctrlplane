import type * as schema from "@ctrlplane/db/schema";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

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

export type RuleEngineRuleResult<T> = {
  allowedCandidates: T[];
  rejectionReasons?: Map<string, string>;
};

/**
 * A rule to filter/reorder the candidate versions.
 */
export interface FilterRule<T> {
  name: string;
  filter(
    candidates: T[],
  ): RuleEngineRuleResult<T> | Promise<RuleEngineRuleResult<T>>;
}

export type PreValidationResult = {
  passing: boolean;
  rejectionReason?: string;
};

export interface PreValidationRule {
  name: string;
  passing(): PreValidationResult | Promise<PreValidationResult>;
}

/**
 * Type guard to check if a rule is a RuleEngineFilter
 */
export function isFilterRule<T>(
  rule: FilterRule<T> | PreValidationRule,
): rule is FilterRule<T> {
  return "filter" in rule;
}

/**
 * Type guard to check if a rule is a PreFetchRuleFilter
 */
export function isPreValidationRule(
  rule: FilterRule<any> | PreValidationRule,
): rule is PreValidationRule {
  return "passing" in rule;
}

export type Policy = schema.Policy & {
  denyWindows: schema.PolicyRuleDenyWindow[];
  deploymentVersionSelector: schema.PolicyDeploymentVersionSelector | null;
  versionAnyApprovals: schema.PolicyRuleAnyApproval | null;
  versionUserApprovals: schema.PolicyRuleUserApproval[];
  versionRoleApprovals: schema.PolicyRuleRoleApproval[];
};

export type ReleaseTargetIdentifier = {
  deploymentId: string;
  environmentId: string;
  resourceId: string;
};

export type RuleSelectionResult<T> = {
  chosenCandidate: T | null;
  rejectionReasons: Map<string, string>;
};

export type RuleEngine<T> = {
  evaluate: (candidates: T[]) => Promise<RuleSelectionResult<T>>;
};

export class ConstantMap<K, V> extends Map<K, V> {
  constructor(private readonly value: V) {
    super();
  }

  get(_: K): V {
    return this.value;
  }

  set(_: K, __: V): this {
    return this;
  }

  delete(_: K): boolean {
    return false;
  }
}
