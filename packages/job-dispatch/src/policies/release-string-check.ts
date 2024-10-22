import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

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
    .from(schema.environment)
    .innerJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .where(
      and(
        inArray(schema.environment.id, envIds),
        isNull(schema.environment.deletedAt),
      ),
    );

  const releaseIds = wf.map((v) => v.releaseId).filter(isPresent);
  const rels = await db
    .select()
    .from(schema.release)
    .where(inArray(schema.release.id, releaseIds));

  return Promise.all(
    wf.map(async (v) => {
      const policy = policies.find((p) => p.environment.id === v.environmentId);
      if (policy == null) return v;

      const { releaseFilter } = policy.environment_policy;
      if (releaseFilter == null) return v;

      const rel = rels.find((r) => r.id === v.releaseId);
      if (rel == null) return v;

      const release = await db
        .select()
        .from(schema.release)
        .where(
          and(
            eq(schema.release.id, rel.id),
            schema.releaseMatchesCondition(db, releaseFilter),
          ),
        )
        .then(takeFirstOrNull);

      return isPresent(release) ? v : null;
    }),
  ).then((results) => results.filter(isPresent));
};
