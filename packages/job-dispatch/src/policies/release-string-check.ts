import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { releaseCondition } from "@ctrlplane/validators/releases";

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

      const rel = rels.find((r) => r.id === v.releaseId);
      if (rel == null) return v;

      const { environment_policy: envPolicy } = policy;
      if (
        envPolicy.evaluateWith === "semver" &&
        satisfies(rel.version, policy.environment_policy.evaluate as string)
      )
        return v;

      if (
        envPolicy.evaluateWith === "regex" &&
        new RegExp(policy.environment_policy.evaluate as string).test(
          rel.version,
        )
      )
        return v;

      if (envPolicy.evaluateWith === "filter") {
        const filter = releaseCondition.parse(
          policy.environment_policy.evaluate,
        );

        const release = await db
          .select()
          .from(schema.release)
          .where(
            and(
              eq(schema.release.id, rel.id),
              schema.releaseMatchesCondition(db, filter),
            ),
          )
          .then(takeFirstOrNull);

        return isPresent(release) ? v : null;
      }

      return null;
    }),
  ).then((results) => results.filter(isPresent));
};
