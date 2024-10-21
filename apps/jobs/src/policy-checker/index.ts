import { and, eq, isNull, or } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const run = async () => {
  const isPassingApprovalGate = or(
    isNull(schema.environment.policyId),
    eq(schema.environmentPolicy.approvalRequirement, "automatic"),
    eq(schema.environmentPolicyApproval.status, "approved"),
  );

  const releaseJobTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
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
    .where(and(eq(schema.job.status, JobStatus.Pending), isPassingApprovalGate))
    .then((rows) => rows.map((row) => row.release_job_trigger));

  if (releaseJobTriggers.length === 0) return;
  console.log(
    `Found [${releaseJobTriggers.length}] release job triggers to dispatch`,
  );

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};
