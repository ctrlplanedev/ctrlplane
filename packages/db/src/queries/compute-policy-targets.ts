import { and, eq, isNull, sql } from "drizzle-orm";

import type { Tx } from "../common.js";
import * as schema from "../schema/index.js";
import { selector } from "../selectors/index.js";

const findMatchingReleaseTargets = (
  tx: Tx,
  policyTarget: schema.PolicyTarget,
) =>
  tx
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .where(
      and(
        isNull(schema.resource.deletedAt),
        selector()
          .query()
          .resources()
          .where(policyTarget.resourceSelector)
          .sql(),
        selector()
          .query()
          .deployments()
          .where(policyTarget.deploymentSelector)
          .sql(),
        selector()
          .query()
          .environments()
          .where(policyTarget.environmentSelector)
          .sql(),
      ),
    )
    .then((rt) =>
      rt.map((rt) => ({
        policyTargetId: policyTarget.id,
        releaseTargetId: rt.release_target.id,
      })),
    );

export const computePolicyTargets = async (
  db: Tx,
  policyTarget: schema.PolicyTarget,
) => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`
            SELECT * from ${schema.computedPolicyTargetReleaseTarget}
            INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.id, schema.computedPolicyTargetReleaseTarget.releaseTargetId)}
            WHERE ${eq(schema.computedPolicyTargetReleaseTarget.policyTargetId, policyTarget.id)}
            FOR UPDATE NOWAIT
          `,
    );

    await tx
      .delete(schema.computedPolicyTargetReleaseTarget)
      .where(
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          policyTarget.id,
        ),
      );

    const releaseTargets = await findMatchingReleaseTargets(tx, policyTarget);

    if (releaseTargets.length > 0)
      await tx
        .insert(schema.computedPolicyTargetReleaseTarget)
        .values(releaseTargets)
        .onConflictDoNothing();
  });
};
