import type { Tx } from "@ctrlplane/db";

import { allRules, and, desc, eq, inArray, isNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { createSpanWrapper } from "../span.js";

/**
 * Gets applicable policies for a given workspace and release repository.
 * Filters policies based on deployment and environment selectors matching the
 * repository.
 *
 * NOTE: This currently iterates through every policy in the workspace to find
 * matches. For workspaces with many policies, we may need to add caching or
 * optimize the query pattern to improve performance.
 *
 * @param tx - Database transaction object for querying
 * @param workspaceId - ID of the workspace to get policies for
 * @param repo - Repository containing deployment, environment and resource IDs
 * @returns Promise resolving to array of matching policies with their targets
 * and deny windows
 */
export const getApplicablePolicies = createSpanWrapper(
  "getApplicablePolicies",
  async (span, tx: Tx, releaseTargetId: string) => {
    span.setAttribute("release.target.id", releaseTargetId);

    const policyIds = await tx
      .selectDistinctOn([schema.policy.id])
      .from(schema.computedPolicyTargetReleaseTarget)
      .innerJoin(
        schema.policyTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          schema.policyTarget.id,
        ),
      )
      .innerJoin(
        schema.policy,
        eq(schema.policyTarget.policyId, schema.policy.id),
      )
      .where(
        and(
          eq(
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
            releaseTargetId,
          ),
          eq(schema.policy.enabled, true),
        ),
      )
      .then((rows) => rows.map((row) => row.policy.id));

    return tx.query.policy.findMany({
      where: inArray(schema.policy.id, policyIds),
      with: allRules,
      orderBy: desc(schema.policy.priority),
    });
  },
);

export const getApplicablePoliciesWithoutResourceScope = async (
  db: Tx,
  environmentId: string,
  deploymentId: string,
) => {
  const policyIdResults = await db
    .selectDistinct({ policyId: schema.policy.id })
    .from(schema.computedPolicyTargetReleaseTarget)
    .innerJoin(
      schema.policyTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .innerJoin(
      schema.policy,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        schema.releaseTarget.id,
      ),
    )
    .where(
      and(
        isNull(schema.policyTarget.resourceSelector),
        eq(schema.releaseTarget.environmentId, environmentId),
        eq(schema.releaseTarget.deploymentId, deploymentId),
        eq(schema.policy.enabled, true),
      ),
    );

  const policyIds = policyIdResults.map((r) => r.policyId);
  if (policyIds.length === 0) return [];
  const where = inArray(schema.policy.id, policyIds);
  return db.query.policy.findMany({ where, with: allRules });
};
