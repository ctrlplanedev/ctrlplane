import { db } from "@ctrlplane/db/client";
import { logger } from "@ctrlplane/logger";

const triggerPolicyEvaluation = async () => {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  let totalProcessed = 0;

  logger.info("Starting policy evaluation for all release targets");

  while (hasMore) {
    try {
      const releaseTargets = await db.query.releaseTarget.findMany({
        limit: PAGE_SIZE,
        offset,
      });

      if (releaseTargets.length === 0) {
        hasMore = false;
        break;
      }

      logger.debug(
        `Processing ${releaseTargets.length} release targets (offset: ${offset})`,
      );
      totalProcessed += releaseTargets.length;

      // await getQueue(Channel.EvaluateReleaseTarget).addBulk(
      //   releaseTargets.map((rt) => ({
      //     name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      //     data: rt,
      //     priority: 10,
      //   })),
      // );

      offset += PAGE_SIZE;
    } catch (error) {
      logger.error("Error during policy evaluation:", error);
      throw error;
    }
  }

  logger.info(
    `Completed policy evaluation for ${totalProcessed} release targets`,
  );
};

export const run = async () => {
  await triggerPolicyEvaluation();
};
