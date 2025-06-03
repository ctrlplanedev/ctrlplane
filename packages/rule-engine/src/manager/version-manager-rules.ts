import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { FilterRule, Policy, PreValidationRule } from "../types";
import type { Version } from "./version-rule-engine";
import { ConcurrencyRule } from "../rules/concurrency-rule.js";
import { DeploymentDenyRule } from "../rules/deployment-deny-rule.js";
import { ReleaseTargetConcurrencyRule } from "../rules/release-target-concurrency-rule.js";
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

export const getConcurrencyRule = (policy: Policy | null) => {
  if (policy?.concurrency == null) return [];
  const getReleaseTargetsInConcurrencyGroup = () =>
    db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.computedPolicyTargetReleaseTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.releaseTargetId,
          schema.releaseTarget.id,
        ),
      )
      .innerJoin(
        schema.policyTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          schema.policyTarget.id,
        ),
      )
      .where(eq(schema.policyTarget.policyId, policy.id))
      .then((rows) => rows.map((row) => row.release_target));

  return [
    new ConcurrencyRule({
      concurrency: policy.concurrency.concurrency,
      getReleaseTargetsInConcurrencyGroup,
    }),
  ];
};

export const getRules = (
  policy: Policy | null,
  releaseTargetId: string,
): Array<FilterRule<Version> | PreValidationRule> => {
  return [
    new ReleaseTargetConcurrencyRule(releaseTargetId),
    ...getConcurrencyRule(policy),
    ...getVersionApprovalRules(policy),
  ];
  // The rrule package is being stupid and deny windows is not top priority
  // right now so I am commenting this out
  // https://github.com/jkbrzt/rrule/issues/478
  // return [...denyWindows(policy), ...getVersionApprovalRules(policy)];
};
