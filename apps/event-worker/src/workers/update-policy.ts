import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

export const updatePolicyWorker = createWorker(
  Channel.UpdatePolicy,
  async (job) => {
    const policyTargets = await db.query.policyTarget.findMany({
      where: eq(schema.policyTarget.policyId, job.data.id),
    });

    for (const policyTarget of policyTargets)
      dispatchQueueJob()
        .toCompute()
        .policyTarget(policyTarget)
        .releaseTargetSelector();
  },
);
