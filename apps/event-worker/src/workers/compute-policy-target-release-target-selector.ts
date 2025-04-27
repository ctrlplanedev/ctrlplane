import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, isNull, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

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
      const rts = await db.transaction(async (tx) => {
        const releaseTargets = await findMatchingReleaseTargets(
          tx,
          policyTarget,
        );

        await tx.execute(
          sql`
            SELECT * from ${schema.computedPolicyTargetReleaseTarget}
            INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.id, schema.computedPolicyTargetReleaseTarget.releaseTargetId)}
            WHERE ${eq(schema.computedPolicyTargetReleaseTarget.policyTargetId, policyTarget.id)}
            FOR UPDATE NOWAIT
          `,
        );

        // Delete existing computed targets
        await tx
          .delete(schema.computedPolicyTargetReleaseTarget)
          .where(
            eq(
              schema.computedPolicyTargetReleaseTarget.policyTargetId,
              policyTarget.id,
            ),
          );

        if (releaseTargets.length === 0) return [];

        // Insert new computed targets
        return tx
          .insert(schema.computedPolicyTargetReleaseTarget)
          .values(releaseTargets)
          .onConflictDoNothing()
          .returning();
      });

      const releaseTargets = await db.query.releaseTarget.findMany({
        where: inArray(
          schema.releaseTarget.id,
          rts.map((rt) => rt.releaseTargetId),
        ),
      });

      const jobs = releaseTargets.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.ComputePolicyTargetReleaseTargetSelector).add(
          job.name,
          job.data,
        );
        return;
      }

      throw e;
    }
  },
);
