import type { FullPolicy } from "@ctrlplane/events";
import type {
  FilterRule,
  PreValidationRule,
  Version,
} from "@ctrlplane/rule-engine";

export interface VersionRuleRepository {
  upsertPolicyRules(policy: FullPolicy): Promise<void>;
  removePolicyRules(policyId: string): Promise<void>;
  getRules(
    policyId: string,
    releaseTargetId: string,
  ): Promise<(FilterRule<Version> | PreValidationRule)[]>;
}
