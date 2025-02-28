import { and, eq, isNull, or } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const run = async () => {
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
          schema.environmentPolicyApproval.releaseId,
          schema.releaseJobTrigger.releaseId,
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
