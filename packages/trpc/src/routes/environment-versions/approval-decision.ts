import type { PolicyResults } from "./types.js";

type ApprovalRuleDetails = {
  allowed: boolean;
  approvers: string[];
  minApprovals: number;
};

export const getApprovalRuleWithResult = (policyResults?: PolicyResults) => {
  const decision = policyResults?.decision;
  if (decision == null) return null;

  for (const { policy, ruleResults } of decision.policyResults) {
    if (policy == null) continue;

    for (const ruleResult of ruleResults) {
      const { ruleId } = ruleResult;
      const rule = policy.rules.find((rule) => rule.id === ruleId);
      if (rule?.anyApproval == null) continue;

      const details: ApprovalRuleDetails = {
        approvers: ruleResult.details.approvers as string[],
        minApprovals: rule.anyApproval.minApprovals,
        allowed: ruleResult.allowed,
      };

      return details;
    }
  }

  return null;
};
