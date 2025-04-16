import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const log = logger.child({ module: "new-deployment" });

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    try {
      await selector()
        .compute()
        .deployments([job.data.id])
        .resourceSelectors()
        .replace();

      const system = await db
        .select()
        .from(schema.system)
        .where(eq(schema.system.id, job.data.systemId))
        .then(takeFirst);
      const { workspaceId } = system;

      await selector()
        .compute()
        .allPolicies(workspaceId)
        .releaseTargetSelectors()
        .replace();

      const computedDeploymentResources = await db
        .select()
        .from(schema.computedDeploymentResource)
        .innerJoin(
          schema.resource,
          eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
        )
        .where(eq(schema.computedDeploymentResource.deploymentId, job.data.id));
      const resources = computedDeploymentResources.map((r) => r.resource);

      const releaseTargetPromises = resources.map(async (r) =>
        upsertReleaseTargets(db, r),
      );
      const fulfilled = await Promise.all(releaseTargetPromises);
      const rts = fulfilled.flat();

      const evaluateJobs = rts.map((rt) => ({ name: rt.id, data: rt }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(evaluateJobs);
    } catch (error) {
      log.error("Error upserting release targets", { error });
      throw error;
    }
  },
);
