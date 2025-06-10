import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { logger } from "@ctrlplane/logger";

import type { Tx } from "../common.js";
import * as schema from "../schema/index.js";
import { selector } from "../selectors/index.js";

const log = logger.child({ component: "computePolicyTargets" });

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
  systemId?: string,
) => {
  try {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`
        SELECT * from ${schema.computedPolicyTargetReleaseTarget}
        INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.id, schema.computedPolicyTargetReleaseTarget.releaseTargetId)}
        WHERE ${eq(schema.computedPolicyTargetReleaseTarget.policyTargetId, policyTarget.id)}
        FOR UPDATE NOWAIT
      `,
      );

      const previous = await tx
        .select()
        .from(schema.computedPolicyTargetReleaseTarget)
        .where(
          eq(
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
            policyTarget.id,
          ),
        );

      const releaseTargets = await findMatchingReleaseTargets(tx, policyTarget);

      const prevIds = new Set(previous.map((rt) => rt.releaseTargetId));
      const nextIds = new Set(releaseTargets.map((rt) => rt.releaseTargetId));
      const deleted = previous.filter((rt) => !nextIds.has(rt.releaseTargetId));
      const created = releaseTargets.filter(
        (rt) => !prevIds.has(rt.releaseTargetId),
      );

      if (deleted.length > 0)
        await tx.delete(schema.computedPolicyTargetReleaseTarget).where(
          inArray(
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
            deleted.map((rt) => rt.releaseTargetId),
          ),
        );

      if (created.length > 0)
        await tx
          .insert(schema.computedPolicyTargetReleaseTarget)
          .values(created)
          .onConflictDoNothing();

      if (systemId === "54ff9e49-335c-4a66-82d8-205d1a917766") {
        log.info("created release targets", {
          created: created.length,
        });
      }

      return [...created, ...deleted].map((rt) => rt.releaseTargetId);
    });
  } catch (e) {
    log.error("Failed to compute policy targets", {
      error: e,
      policyTargetId: policyTarget.id,
    });
    throw e;
  }
};
