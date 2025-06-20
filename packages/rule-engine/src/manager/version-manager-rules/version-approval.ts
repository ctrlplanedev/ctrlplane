import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { FilterRule, Policy } from "../../types.js";
import type { Version } from "../version-rule-engine.js";
import {
  getAnyApprovalRecordsGetter,
  getRoleApprovalRecordsGetter,
  getUserApprovalRecordsGetter,
  VersionApprovalRule,
} from "../../rules/version-approval-rule.js";

export const versionAnyApprovalRule = (
  environmentId: string,
  approvalRules?: Policy["versionAnyApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return [
    new VersionApprovalRule({
      minApprovals: approvalRules.requiredApprovalsCount,
      getApprovalRecords: getAnyApprovalRecordsGetter(environmentId),
    }),
  ];
};

export const versionRoleApprovalRule = (
  environmentId: string,
  approvalRules?: Policy["versionRoleApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return approvalRules.map(
    (approval) =>
      new VersionApprovalRule({
        minApprovals: approval.requiredApprovalsCount,
        getApprovalRecords: getRoleApprovalRecordsGetter(environmentId),
      }),
  );
};

export const versionUserApprovalRule = (
  environmentId: string,
  approvalRules?: Policy["versionUserApprovals"] | null,
) => {
  if (approvalRules == null) return [];
  return approvalRules.map(
    () =>
      new VersionApprovalRule({
        minApprovals: 1,
        getApprovalRecords: getUserApprovalRecordsGetter(environmentId),
      }),
  );
};

export const getVersionApprovalRules = async (
  policy: Policy | null,
  releaseTargetId: string,
): Promise<FilterRule<Version>[]> => {
  const releaseTarget = await db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst);
  const { environmentId } = releaseTarget;
  return [
    ...versionUserApprovalRule(environmentId, policy?.versionUserApprovals),
    ...versionAnyApprovalRule(environmentId, policy?.versionAnyApprovals),
    ...versionRoleApprovalRule(environmentId, policy?.versionRoleApprovals),
  ];
};
