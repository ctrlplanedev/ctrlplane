import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { HookAction } from "@ctrlplane/validators/events";

const log = logger.child({ worker: "deleted-release-target" });

/**
 * This worker is used to handle post-processing of a deleted release target
 * NOTE that the release target has already been deleted by the time this worker
 * is called.
 */
export const deletedReleaseTargetWorker = createWorker(
  Channel.DeletedReleaseTarget,
  async (job) => {
    try {
      const { data: releaseTarget } = job;
      const { deploymentId, resourceId } = releaseTarget;

      const [deployment, resource] = await Promise.all([
        db
          .select()
          .from(schema.deployment)
          .where(eq(schema.deployment.id, deploymentId))
          .then(takeFirstOrNull),
        db
          .select()
          .from(schema.resource)
          .where(eq(schema.resource.id, resourceId))
          .then(takeFirst),
      ]);

      if (deployment == null) {
        log.warn(
          "Deployment not found, skipping creating deployment.resource.removed event",
          { deploymentId },
        );
        return;
      }

      const event = {
        action: HookAction.DeploymentResourceRemoved,
        payload: { deployment, resource },
      };

      await handleEvent(event);
    } catch (error) {
      log.error("Error processing deleted release target", error);
    }
  },
);
