import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, isNull, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { dispatchComputePolicyTargetReleaseTargetSelectorJobs } from "../utils/dispatch-compute-policy-target-selector-jobs.js";
import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const log = logger.child({
  worker: "compute-policy-target-release-target-selector",
});

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

export const computePolicyTargetReleaseTargetSelectorWorkerEvent = createWorker(
  Channel.ComputePolicyTargetReleaseTargetSelector,
  async (job) => {
    const { id } = job.data;

    const policyTarget = await db.query.policyTarget.findFirst({
      where: eq(schema.policyTarget.id, id),
    });

    if (policyTarget == null) throw new Error("Policy target not found");

    try {
      const affectedReleaseTargetIds = await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            SELECT * from ${schema.computedPolicyTargetReleaseTarget}
            INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.id, schema.computedPolicyTargetReleaseTarget.releaseTargetId)}
            WHERE ${eq(schema.computedPolicyTargetReleaseTarget.policyTargetId, policyTarget.id)}
            FOR UPDATE NOWAIT
          `,
        );

        const previous = await tx
          .delete(schema.computedPolicyTargetReleaseTarget)
          .where(
            eq(
              schema.computedPolicyTargetReleaseTarget.policyTargetId,
              policyTarget.id,
            ),
          )
          .returning();

        const releaseTargets = await findMatchingReleaseTargets(
          tx,
          policyTarget,
        );

        const unmatched = previous.filter(
          (previousRt) =>
            !releaseTargets.some(
              (rt) => rt.releaseTargetId === previousRt.releaseTargetId,
            ),
        );

        const newReleaseTargets = releaseTargets.filter(
          (rt) =>
            !previous.some(
              (previousRt) => previousRt.releaseTargetId === rt.releaseTargetId,
            ),
        );

        if (releaseTargets.length > 0)
          await tx
            .insert(schema.computedPolicyTargetReleaseTarget)
            .values(releaseTargets)
            .onConflictDoNothing();

        return [...unmatched, ...newReleaseTargets].map(
          (rt) => rt.releaseTargetId,
        );
      });

      const affectedReleaseTargets = await db
        .select()
        .from(schema.releaseTarget)
        .where(inArray(schema.releaseTarget.id, affectedReleaseTargetIds));

      await dispatchEvaluateJobs(affectedReleaseTargets);
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        log.info(
          "Row locked in compute-policy-target-release-target-selector, requeueing...",
          { job },
        );
        dispatchComputePolicyTargetReleaseTargetSelectorJobs(policyTarget);
        return;
      }

      throw e;
    }
  },
);
