import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchComputePolicyTargetReleaseTargetSelectorJobs } from "../utils/dispatch-compute-policy-target-selector-jobs.js";

export const updatePolicyWorker = createWorker(
  Channel.UpdatePolicy,
  async (job) => {
    const policyTargets = await db.query.policyTarget.findMany({
      where: eq(schema.policyTarget.policyId, job.data.id),
    });

    for (const policyTarget of policyTargets)
      dispatchComputePolicyTargetReleaseTargetSelectorJobs(policyTarget);
  },
);
