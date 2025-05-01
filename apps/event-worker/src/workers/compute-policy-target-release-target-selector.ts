import type { Tx } from "@ctrlplane/db";

import { and, eq, isNull, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

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
      with: { policy: true },
    });

    if (policyTarget == null) throw new Error("Policy target not found");

    const { policy } = policyTarget;
    const { workspaceId } = policy;

    try {
      await db.transaction(async (tx) => {
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

        const releaseTargets = await findMatchingReleaseTargets(
          tx,
          policyTarget,
        );

        if (releaseTargets.length === 0) return;
        await tx
          .insert(schema.computedPolicyTargetReleaseTarget)
          .values(releaseTargets)
          .onConflictDoNothing();
      });

      const releaseTargets = await db
        .select()
        .from(schema.releaseTarget)
        .innerJoin(
          schema.resource,
          eq(schema.releaseTarget.resourceId, schema.resource.id),
        )
        .where(
          and(
            isNull(schema.resource.deletedAt),
            eq(schema.resource.workspaceId, workspaceId),
          ),
        )
        .then((rows) => rows.map((row) => row.release_target));

      await dispatchEvaluateJobs(releaseTargets);
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
