import type { DeploymentResourceContext, Release } from "./types";
import type { Policy } from "./types.js";
import { Releases } from "./releases.js";
import { RuleEngine } from "./rule-engine.js";
import { DeploymentDenyRule } from "./rules/deployment-deny-rule.js";
import { mergePolicies } from "./utils/merge-policies.js";

const denyWindows = (policy: Policy | null) =>
  policy == null
    ? []
    : policy.denyWindows.map(
        (denyWindow) =>
          new DeploymentDenyRule({
            ...denyWindow,
            tzid: denyWindow.timeZone,
            dtend: denyWindow.dtend,
          }),
      );

/**
 * Evaluates a deployment context against policy rules to determine if the
 * deployment is allowed.
 *
 * @param policy - The policy containing deployment rules and deny windows
 * @param releases - One or more releases to evaluate
 * @param context - The deployment context containing information needed for
 * rule evaluation
 * @returns A promise resolving to the evaluation result, including allowed
 * status and chosen release
 */
export const evaluate = (
  policy: Policy | Policy[] | null,
  releases: Release[] | Release,
  context: DeploymentResourceContext,
) => {
  const policies =
    policy == null ? [] : Array.isArray(policy) ? policy : [policy];
  const mergedPolicy = mergePolicies(policies);
  const rules = [...denyWindows(mergedPolicy)];
  const engine = new RuleEngine(rules);
  const releaseCollection = Releases.from(releases);
  return engine.evaluate(releaseCollection, context);
};
