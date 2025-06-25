import type { Tx } from "@ctrlplane/db";

import { desc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const getMatchedPolicies = async (
  db: Tx,
  releaseTarget: schema.ReleaseTarget,
) =>
  db
    .select({
      policyId: schema.policy.id,
      concurrency: schema.policyRuleConcurrency,
      retry: schema.policyRuleRetry,
    })
    .from(schema.policy)
    .innerJoin(
      schema.policyTarget,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .innerJoin(
      schema.computedPolicyTargetReleaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .leftJoin(
      schema.policyRuleRetry,
      eq(schema.policyRuleRetry.policyId, schema.policy.id),
    )
    .leftJoin(
      schema.policyRuleConcurrency,
      eq(schema.policyRuleConcurrency.policyId, schema.policy.id),
    )
    .where(
      eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        releaseTarget.id,
      ),
    )
    .orderBy(desc(schema.policy.priority));
