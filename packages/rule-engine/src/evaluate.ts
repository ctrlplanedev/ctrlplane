import _ from "lodash";

import type { ReleaseRepository } from "./repositories/types.js";
import type { DeploymentResourceContext, GetReleasesFunc } from "./types";
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
 * @param getReleases - A function that returns a list of releases for a given
 * policy
 * @param context - The deployment context containing information needed for
 * rule evaluation
 * @returns A promise resolving to the evaluation result, including allowed
 * status and chosen release
 */
export const evaluate = async (
  policy: Policy | Policy[] | null,
  context: DeploymentResourceContext,
  getReleases: GetReleasesFunc,
) => {
  const policies =
    policy == null ? [] : Array.isArray(policy) ? policy : [policy];

  const mergedPolicy = mergePolicies(policies);
  if (mergedPolicy == null)
    return {
      allowed: false,
      release: undefined,
    };

  const rules = [...denyWindows(mergedPolicy)];
  const engine = new RuleEngine(rules);
  const releases = await getReleases(context, mergedPolicy);
  const releaseCollection = Releases.from(releases);
  return engine.evaluate(releaseCollection, context);
};

export const evaluateRepository = async (repository: ReleaseRepository) => {
  const ctx = await repository.getCtx();
  if (ctx == null) return { allowed: false, release: undefined };

  const releases = await repository.findMatchingReleases();
  const resolvedReleases = releases.map((r) => ({
    ...r,
    version: {
      ...r.version,
      metadata: _(r.version.metadata)
        .map((v) => [v.key, v.value])
        .fromPairs()
        .value(),
    },
    variables: _(r.variables)
      .map((v) => [v.key, v.value])
      .fromPairs()
      .value(),
  }));
  const releaseCollection = Releases.from(resolvedReleases);

  const policy = await repository.getPolicy();
  const rules = [...denyWindows(policy)];
  const engine = new RuleEngine(rules);

  return engine.evaluate(releaseCollection, ctx);
};
