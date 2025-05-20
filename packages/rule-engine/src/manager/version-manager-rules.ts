import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { FilterRule, Policy, PreValidationRule } from "../types";
import type { Version } from "./version-rule-engine";
import { DeploymentDenyRule } from "../rules/deployment-deny-rule.js";
import { GradualRolloutRule } from "../rules/gradual-rollout-rule.js";
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

export const gradualRolloutRule = (
  policy: Policy | null,
  releaseTargetId: string,
) => {
  if (policy?.gradualRollout == null) return null;
  const getRolloutStartTime = async (version: Version) => {
    const policyHasApprovalRules = getVersionApprovalRules(policy).length > 0;
    if (!policyHasApprovalRules) return version.createdAt;

    const anyApprovalRecords = await getAnyApprovalRecords([version.id]);
    const userApprovalRecords = await getUserApprovalRecords([version.id]);
    const roleApprovalRecords = await getRoleApprovalRecords([version.id]);

    // the rollout rule will be the last rule that runs in the filter chain
    // hence if it is passing and the policy has approval rules, the version is fully approved
    // so we can safely return the latest approval record approvedAt as the start of the rollout
    const latestRecord = _.chain([
      ...anyApprovalRecords,
      ...userApprovalRecords,
      ...roleApprovalRecords,
    ])
      .filter((r) => r.approvedAt != null)
      .maxBy((r) => r.approvedAt)
      .value();

    return latestRecord.approvedAt ?? version.createdAt;
  };

  const getReleaseTargetPosition = async (version: Version) => {
    const releaseTarget = await db.query.releaseTarget.findFirst({
      where: eq(schema.releaseTarget.id, releaseTargetId),
    });

    if (releaseTarget == null)
      throw new Error(`Release target ${releaseTargetId} not found`);

    const orderedTargetsSubquery = db
      .select({
        id: schema.releaseTarget.id,
        position:
          sql<number>`ROW_NUMBER() OVER (ORDER BY md5(id || ${version.id}) ASC) - 1`.as(
            "position",
          ),
      })
      .from(schema.releaseTarget)
      .where(
        and(
          eq(schema.releaseTarget.environmentId, releaseTarget.environmentId),
          eq(schema.releaseTarget.deploymentId, releaseTarget.deploymentId),
        ),
      )
      .as("ordered_targets");

    return db
      .select()
      .from(orderedTargetsSubquery)
      .where(eq(orderedTargetsSubquery.id, releaseTargetId))
      .then(takeFirst)
      .then((r) => r.position);
  };

  return new GradualRolloutRule({
    ...policy.gradualRollout,
    getRolloutStartTime,
    getReleaseTargetPosition,
  });
};

export const getRules = (
  policy: Policy | null,
  releaseTargetId: string,
): Array<FilterRule<Version> | PreValidationRule> => {
  return [
    new ReleaseTargetConcurrencyRule(releaseTargetId),
    ...getVersionApprovalRules(policy),

    // keep gradual rollout rule last in the chain
    // as a rollout does not start until the version has cleared all other rules
    gradualRolloutRule(policy, releaseTargetId),
  ].filter(isPresent);
  // The rrule package is being stupid and deny windows is not top priority
  // right now so I am commenting this out
  // https://github.com/jkbrzt/rrule/issues/478
  // return [...denyWindows(policy), ...getVersionApprovalRules(policy)];
};
