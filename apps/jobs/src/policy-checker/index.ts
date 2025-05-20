import { alias, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

const triggerPolicyEvaluation = async () => {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  let totalProcessed = 0;

  logger.info("Starting policy evaluation for all release targets");

  while (hasMore) {
    try {
      const ct = alias(schema.computedPolicyTargetReleaseTarget, "ct");

      const releaseTargets = await db
        .select()
        .from(schema.policy)
        .innerJoin(
          schema.policyTarget,
          eq(schema.policyTarget.policyId, schema.policy.id),
        )
        .innerJoin(ct, eq(ct.policyTargetId, schema.policyTarget.id))
        .innerJoin(
          schema.releaseTarget,
          eq(ct.releaseTargetId, schema.releaseTarget.id),
        )
        .innerJoin(
          schema.policyRuleGradualRollout,
          eq(schema.policyRuleGradualRollout.policyId, schema.policy.id),
        )
        .limit(PAGE_SIZE)
        .offset(offset)
        .then((rows) => rows.map((row) => row.release_target));

      if (releaseTargets.length === 0) {
        hasMore = false;
        break;
      }

      logger.debug(
        `Processing ${releaseTargets.length} release targets (offset: ${offset})`,
      );
      totalProcessed += releaseTargets.length;

      offset += PAGE_SIZE;

      await getQueue(Channel.EvaluateReleaseTarget).addBulk(
        releaseTargets.map((rt) => ({
          name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
          data: rt,
          priority: 10,
        })),
      );
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
