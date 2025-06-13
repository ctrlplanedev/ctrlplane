import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

const getReleaseTargetsAffectedByRolloutRule = (
  limit: number,
  offset: number,
) =>
  db
    .selectDistinctOn([schema.releaseTarget.id])
    .from(schema.policy)
    .innerJoin(
      schema.policyRuleEnvironmentVersionRollout,
      eq(schema.policyRuleEnvironmentVersionRollout.policyId, schema.policy.id),
    )
    .innerJoin(
      schema.policyTarget,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .innerJoin(
      schema.computedPolicyTargetReleaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(
        schema.releaseTarget.id,
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
      ),
    )
    .limit(limit)
    .offset(offset)
    .then((rows) => rows.map((row) => row.release_target));

const triggerPolicyEvaluation = async () => {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  let totalProcessed = 0;

  logger.info("Starting policy evaluation for all release targets");

  while (hasMore) {
    try {
      const releaseTargets = await getReleaseTargetsAffectedByRolloutRule(
        PAGE_SIZE,
        offset,
      );

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
