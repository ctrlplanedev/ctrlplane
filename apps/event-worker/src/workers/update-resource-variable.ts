import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const log = logger.child({ module: "update-resource-variable" });

export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    try {
      const { data } = job;
      const { resourceId } = data;

      const resource = await db
        .select()
        .from(schema.resource)
        .where(eq(schema.resource.id, resourceId))
        .then(takeFirst);
      const { workspaceId } = resource;

      const cb = selector().compute();

      await Promise.all([
        cb.allEnvironments(workspaceId).resourceSelectors().replace(),
        cb.allDeployments(workspaceId).resourceSelectors().replace(),
      ]);

      await cb.allPolicies(workspaceId).releaseTargetSelectors().replace();
      const rts = await upsertReleaseTargets(db, resource);
      const jobs = rts.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
    } catch (error) {
      log.error("Error updating resource variable", { error });
      throw error;
    }
  },
);
