import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { computePolicyTargets } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { dispatchComputePolicyTargetReleaseTargetSelectorJobs } from "../utils/dispatch-compute-policy-target-selector-jobs.js";
import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const log = logger.child({
  worker: "compute-policy-target-release-target-selector",
});

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

      dispatchEvaluateJobs(releaseTargets);
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
