import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { computePolicyTargets } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

export const computePolicyTargetReleaseTargetSelectorWorkerEvent = createWorker(
  Channel.ComputePolicyTargetReleaseTargetSelector,
  async (job) => {
    const { id } = job.data;

    const policyTarget = await db.query.policyTarget.findFirst({
      where: eq(schema.policyTarget.id, id),
    });

    if (policyTarget == null) throw new Error("Policy target not found");

    try {
      const changedReleaseTaretIds = await computePolicyTargets(
        db,
        policyTarget,
      );

      const releaseTargets = await db
        .select()
        .from(schema.releaseTarget)
        .innerJoin(
          schema.resource,
          eq(schema.releaseTarget.resourceId, schema.resource.id),
        )
        .where(
          and(
            inArray(schema.releaseTarget.id, changedReleaseTaretIds),
            isNull(schema.resource.deletedAt),
          ),
        )
        .then((rows) => rows.map((row) => row.release_target));

      dispatchQueueJob().toEvaluate().releaseTargets(releaseTargets);
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        dispatchQueueJob()
          .toCompute()
          .policyTarget(policyTarget)
          .releaseTargetSelector();
        return;
      }

      throw e;
    }
  },
);
