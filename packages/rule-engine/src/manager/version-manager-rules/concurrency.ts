import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Policy } from "../../types";
import { ConcurrencyRule } from "../../rules/concurrency-rule.js";

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
