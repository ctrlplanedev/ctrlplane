import type { Policy, RuleEngineFilter } from "../types";
import type { Version } from "./version-rule-engine";
import { DeploymentDenyRule } from "../rules/deployment-deny-rule.js";
import {
  getAnyApprovalRecords,
  getRoleApprovalRecords,
  getUserApprovalRecords,
  VersionApprovalRule,
} from "../rules/version-approval-rule.js";

const denyWindows = (policy: Policy | null) =>
  policy == null
    ? []
    : policy.denyWindows.map(
        (denyWindow) =>
          new DeploymentDenyRule<Version>({
            ...denyWindow.rrule,
            tzid: denyWindow.timeZone,
            dtend: denyWindow.dtend,
            getCandidateId: (candidate) => candidate.id,
          }),
      );

const versionAnyApprovalRule = (
  approvalRules?: Policy["versionAnyApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return approvalRules.map(
    (approval) =>
      new VersionApprovalRule({
        minApprovals: approval.requiredApprovalsCount,
        getApprovalRecords: getAnyApprovalRecords,
      }),
  );
};

const versionRoleApprovalRule = (
  approvalRules?: Policy["versionRoleApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return approvalRules.map(
    (approval) =>
      new VersionApprovalRule({
        minApprovals: approval.requiredApprovalsCount,
        getApprovalRecords: getRoleApprovalRecords,
      }),
  );
};

const versionUserApprovalRule = (
  approvalRules?: Policy["versionUserApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return approvalRules.map(
    () =>
      new VersionApprovalRule({
        minApprovals: 1,
        getApprovalRecords: getUserApprovalRecords,
      }),
  );
};

export const getRules = (
  policy: Policy | null,
): RuleEngineFilter<Version>[] => {
  return [
    ...denyWindows(policy),
    ...versionUserApprovalRule(policy?.versionUserApprovals),
    ...versionAnyApprovalRule(policy?.versionAnyApprovals),
    ...versionRoleApprovalRule(policy?.versionRoleApprovals),
  ];
};
