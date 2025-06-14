import type { FilterRule, Policy } from "../../types.js";
import type { Version } from "../version-rule-engine.js";
import {
  getAnyApprovalRecords,
  getRoleApprovalRecords,
  getUserApprovalRecords,
  VersionApprovalRule,
} from "../../rules/version-approval-rule.js";

export const versionAnyApprovalRule = (
  approvalRules?: Policy["versionAnyApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return [
    new VersionApprovalRule({
      minApprovals: approvalRules.requiredApprovalsCount,
      getApprovalRecords: getAnyApprovalRecords,
    }),
  ];
};

export const versionRoleApprovalRule = (
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

export const versionUserApprovalRule = (
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

export const getVersionApprovalRules = (
  policy: Policy | null,
): FilterRule<Version>[] => [
  ...versionUserApprovalRule(policy?.versionUserApprovals),
  ...versionAnyApprovalRule(policy?.versionAnyApprovals),
  ...versionRoleApprovalRule(policy?.versionRoleApprovals),
];
