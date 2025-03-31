import type { Tx } from "@ctrlplane/db";

import type { DeploymentResourceContext } from "./types";
import type { Policy } from "./types.js";
import { Releases } from "./releases.js";
import { RuleEngine } from "./rule-engine.js";
import { DeploymentDenyRule } from "./rules/deployment-deny-rule.js";
import { getReleases } from "./utils/get-releases.js";
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
 */
export const evaluate = async (
  db: Tx,
  policy: Policy | Policy[] | null,
  context: DeploymentResourceContext,
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
  const releases = await getReleases(db, context, mergedPolicy);
  const releaseCollection = Releases.from(releases);
  return engine.evaluate(releaseCollection, context);
};
