import { and, eq, isNull, or } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

const triggerPolicyEvaluation = async () => {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;
  let totalProcessed = 0;

  logger.info('Starting policy evaluation for all release targets');
  
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

      logger.debug(`Processing ${releaseTargets.length} release targets (offset: ${offset})`);
      totalProcessed += releaseTargets.length;
      
      getQueue(Channel.EvaluateReleaseTarget).addBulk(
        releaseTargets.map((rt) => ({
          name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
          data: rt,
        })),
      );

      offset += PAGE_SIZE;
    } catch (error) {
      logger.error('Error during policy evaluation:', error);
      throw error;
    }
  }
  
  logger.info(`Completed policy evaluation for ${totalProcessed} release targets`);
};

export const run = async () => {
  await triggerPolicyEvaluation();

  const isPassingApprovalGate = or(
    eq(schema.environmentPolicy.approvalRequirement, "automatic"),
    eq(schema.environmentPolicyApproval.status, "approved"),
  );
  const isJobPending = eq(schema.job.status, JobStatus.Pending);
  const isActiveResource = isNull(schema.resource.deletedAt);

  const releaseJobTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
    )
    .leftJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .leftJoin(
      schema.environmentPolicyApproval,
      and(
        eq(
          schema.environmentPolicyApproval.policyId,
          schema.environmentPolicy.id,
        ),
        eq(
          schema.environmentPolicyApproval.deploymentVersionId,
          schema.releaseJobTrigger.versionId,
        ),
      ),
    )
    .where(and(isJobPending, isPassingApprovalGate, isActiveResource))
    .then((rows) => rows.map((row) => row.release_job_trigger));

  if (releaseJobTriggers.length === 0) return;
  logger.info(
    `Found [${releaseJobTriggers.length}] release job triggers to dispatch`,
  );

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};
