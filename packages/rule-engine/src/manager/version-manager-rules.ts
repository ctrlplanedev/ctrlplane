import type { FilterRule, Policy, PreValidationRule } from "../types";
import type { Version } from "./version-rule-engine";
import { DeploymentDenyRule } from "../rules/deployment-deny-rule.js";
import {
  getAnyApprovalRecords,
  getRoleApprovalRecords,
  getUserApprovalRecords,
  VersionApprovalRule,
} from "../rules/version-approval-rule.js";

export const denyWindows = (policy: Policy | null) =>
  policy == null
    ? []
    : policy.denyWindows.map(
        (denyWindow) =>
          new DeploymentDenyRule({
            ...denyWindow.rrule,
            tzid: denyWindow.timeZone,
            dtend: denyWindow.dtend,
          }),
      );

const versionAnyApprovalRule = (
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

export const getVersionApprovalRules = (
  policy: Policy | null,
): FilterRule<Version>[] => [
  ...versionUserApprovalRule(policy?.versionUserApprovals),
  ...versionAnyApprovalRule(policy?.versionAnyApprovals),
  ...versionRoleApprovalRule(policy?.versionRoleApprovals),
];

export const getRules = (
  policy: Policy | null,
): Array<FilterRule<Version> | PreValidationRule> => {
  return [
    ...denyWindows(policy),
    // ...versionUserApprovalRule(policy?.versionUserApprovals),
    // ...versionAnyApprovalRule(policy?.versionAnyApprovals),
    ...versionRoleApprovalRule(policy?.versionRoleApprovals),
  ];
};
