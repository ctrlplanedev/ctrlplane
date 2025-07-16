import type { FilterRule, Policy, PreValidationRule } from "../types";
import type { Version } from "./version-rule-engine";
import { DeploymentDenyRule } from "../rules/deployment-deny-rule.js";
import { ReleaseTargetConcurrencyRule } from "../rules/release-target-concurrency-rule.js";
import { ReleaseTargetLockRule } from "../rules/release-target-lock-rule.js";
import { getConcurrencyRule } from "./version-manager-rules/concurrency.js";
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

export type GetAllRulesOptions = {
  policy: Policy | null;
  releaseTargetId: string;
};

export const getAllRules = async (
  opts: GetAllRulesOptions,
): Promise<Array<FilterRule<Version> | PreValidationRule>> => {
  const { policy, releaseTargetId } = opts;
  const environmentVersionRolloutRule = await getEnvironmentVersionRolloutRule(
    policy,
    releaseTargetId,
  );
  const versionApprovalRules = await getVersionApprovalRules(
    policy,
    releaseTargetId,
  );
  return [
    new ReleaseTargetLockRule({ releaseTargetId }),
    new ReleaseTargetConcurrencyRule(releaseTargetId),
    ...getConcurrencyRule(policy),
    ...versionApprovalRules,
    ...(environmentVersionRolloutRule ? [environmentVersionRolloutRule] : []),
  ];
  // The rrule package is being stupid and deny windows is not top priority
  // right now so I am commenting this out
  // https://github.com/jkbrzt/rrule/issues/478
  // return [...denyWindows(policy), ...getVersionApprovalRules(policy)];
};
