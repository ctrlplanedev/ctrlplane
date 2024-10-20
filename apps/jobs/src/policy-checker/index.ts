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

const log = logger.child({ label: "policy-checker" });

export const run = async () => {
  const releaseJobTriggers = await db
    .select({ releaseJobTrigger: schema.releaseJobTrigger })
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .leftJoin(
      schema.environmentPolicyApproval,
      eq(
        schema.environment.policyId,
        schema.environmentPolicyApproval.policyId,
      ),
    )
    .where(
      and(
        eq(schema.job.status, JobStatus.Pending),
        or(
          isNull(schema.environmentPolicyApproval.id),
          eq(schema.environmentPolicyApproval.status, "approved"),
        ),
      ),
    )
    .then((rows) => rows.map((row) => row.releaseJobTrigger));

  if (releaseJobTriggers.length === 0) return;
  log.info(
    `Found [${releaseJobTriggers.length}] release job triggers to dispatch`,
  );

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};
