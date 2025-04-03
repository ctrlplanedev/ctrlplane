import { createReleases } from "src/releases/create-release";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

/**
 * Worker that handles resource variable changes by triggering evaluations for
 * all existing release targets related to that resource. This keeps the logic
 * simple by re-evaluating all affected releases.
 *
 * Note: This assumes that release targets have been correctly created
 * previously. The worker only handles re-evaluation of existing targets.
 */
export const changeResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    const variable = await db.query.resourceVariable.findFirst({
      where: eq(schema.resourceVariable.id, job.data.id),
      with: { resource: true },
    });

    if (variable == null) throw new Error("Resource variable not found");

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: eq(schema.releaseTarget.resourceId, variable.resourceId),
    });

    await createReleases(releaseTargets);
  },
);
