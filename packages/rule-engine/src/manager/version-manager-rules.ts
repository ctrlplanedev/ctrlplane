import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { FilterRule, Policy, PreValidationRule } from "../types";
import type { Version } from "./version-rule-engine";
import { ConcurrencyRule } from "../rules/concurrency-rule.js";
import { DeploymentDenyRule } from "../rules/deployment-deny-rule.js";
import { ReleaseTargetConcurrencyRule } from "../rules/release-target-concurrency-rule.js";
import { ReleaseTargetLockRule } from "../rules/release-target-lock-rule.js";
import {
  getEnvironmentVersionRolloutRule,
  getVersionApprovalRules,
} from "./version-manager-rules/index.js";

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

export const getRules = async (
  policy: Policy | null,
  releaseTargetId: string,
): Promise<Array<FilterRule<Version> | PreValidationRule>> => {
  const environmentVersionRolloutRule = await getEnvironmentVersionRolloutRule(
    policy,
    releaseTargetId,
  );
  return [
    new ReleaseTargetLockRule(releaseTargetId),
    new ReleaseTargetConcurrencyRule(releaseTargetId),
    ...getConcurrencyRule(policy),
    ...getVersionApprovalRules(policy),
    ...(environmentVersionRolloutRule ? [environmentVersionRolloutRule] : []),
  ];
  // The rrule package is being stupid and deny windows is not top priority
  // right now so I am commenting this out
  // https://github.com/jkbrzt/rrule/issues/478
  // return [...denyWindows(policy), ...getVersionApprovalRules(policy)];
};
