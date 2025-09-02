import type {
  FilterRule,
  PreValidationRule,
  Version,
} from "@ctrlplane/rule-engine";

export interface VersionRuleRepository {
  getRules(
    policyId: string,
    releaseTargetId: string,
  ): Promise<(FilterRule<Version> | PreValidationRule)[]>;
}
