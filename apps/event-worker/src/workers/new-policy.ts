import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const newPolicyWorker = createWorker(Channel.NewPolicy, async (job) => {
  const policyTargets = await db.query.policyTarget.findMany({
    where: eq(schema.policyTarget.policyId, job.data.id),
  });

  for (const policyTarget of policyTargets) {
    getQueue(Channel.ComputePolicyTargetReleaseTargetSelector).add(
      policyTarget.id,
      policyTarget,
    );
  }
});
