import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { environment, environmentPolicy, release } from "@ctrlplane/db/schema";

import type { ReleasePolicyChecker } from "./utils.js";

/**
 *
 * @param db
 * @param wf
 * @returns A promise that resolves to the release job triggers that pass the
 * regex or semver policy, if any.
 */
export const isPassingReleaseStringCheckPolicy: ReleasePolicyChecker = async (
  db,
  wf,
) => {
  const envIds = wf.map((v) => v.environmentId).filter(isPresent);
  const policies = await db
    .select()
    .from(environment)
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
    )
    .where(and(inArray(environment.id, envIds), isNull(environment.deletedAt)));

  const releaseIds = wf.map((v) => v.releaseId).filter(isPresent);
  const rels = await db
    .select()
    .from(release)
    .where(inArray(release.id, releaseIds));

  return wf.filter((v) => {
    const policy = policies.find((p) => p.environment.id === v.environmentId);
    if (policy == null) return true;

    const rel = rels.find((r) => r.id === v.releaseId);
    if (rel == null) return true;

    const { environment_policy: envPolicy } = policy;
    if (envPolicy.evaluateWith === "semver")
      return satisfies(rel.version, policy.environment_policy.evaluate);

    if (envPolicy.evaluateWith === "regex")
      return new RegExp(policy.environment_policy.evaluate).test(rel.version);

    return true;
  });
};
