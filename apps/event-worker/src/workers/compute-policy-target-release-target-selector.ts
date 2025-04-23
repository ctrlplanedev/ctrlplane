import { and, eq, inArray, isNull, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { withMutex } from "../utils/with-mutex.js";

export const computePolicyTargetReleaseTargetSelectorWorkerEvent = createWorker(
  Channel.ComputePolicyTargetReleaseTargetSelector,
  async (job) => {
    const { id } = job.data;

    const policyTarget = await db.query.policyTarget.findFirst({
      where: eq(schema.policyTarget.id, id),
    });

    if (policyTarget == null) throw new Error("Policy target not found");

    const key = `${Channel.ComputePolicyTargetReleaseTargetSelector}:${policyTarget.id}`;
    const [acquired, rts] = await withMutex(key, () =>
      db.transaction(async (tx) => {
        await tx
          .delete(schema.computedPolicyTargetReleaseTarget)
          .where(
            eq(
              schema.computedPolicyTargetReleaseTarget.policyTargetId,
              policyTarget.id,
            ),
          );

        const releaseTargets = await tx
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

        if (releaseTargets.length === 0) return [];
        return tx
          .insert(schema.computedPolicyTargetReleaseTarget)
          .values(releaseTargets)
          .onConflictDoNothing()
          .returning();
      }),
    );

    if (!acquired) {
      await getQueue(Channel.ComputePolicyTargetReleaseTargetSelector).add(
        job.name,
        job.data,
        { deduplication: { id: job.data.id, ttl: 500 } },
      );
      return;
    }

    if (rts == null) return;
    if (rts.length === 0) return;

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: inArray(
        schema.releaseTarget.id,
        rts.map((rt) => rt.releaseTargetId),
      ),
    });

    const jobs = releaseTargets.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
      opts: { deduplication: { id: rt.id, ttl: 500 } },
    }));
    await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
  },
);
