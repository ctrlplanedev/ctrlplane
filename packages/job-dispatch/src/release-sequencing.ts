import type { Tx } from "@ctrlplane/db";

import { inArray, isNull, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { updateJob } from "./job-update.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns A Promise that resolves when the release job triggers are cancelled. release job triggers are cancelled
 * if there is a policy on the environment specifying that old release job triggers should be cancelled
 * upon a new job config being dispatched. It "cancels" the release job triggers by creating a job
 * with the status "cancelled".
 */
export const cancelOldReleaseJobTriggersOnJobDispatch = async (
  db: Tx,
  releaseJobTriggers: schema.ReleaseJobTrigger[],
): Promise<void> => {
  if (releaseJobTriggers.length === 0) return;

  // https://github.com/drizzle-team/drizzle-orm/issues/1242
  // https://github.com/drizzle-team/drizzle-orm/issues/2772
  const triggersSubquery = sql`
    select 
      ${schema.job.id} as jobIdToCancel, 
      ${schema.release.id} as cancelReleaseId, 
      ${schema.deployment.id} as cancelDeploymentId, 
      ${schema.releaseJobTrigger.environmentId} as cancelEnvironmentId,
      ${schema.release.createdAt} as cancelReleaseCreatedAt
    from ${schema.job}
    inner join ${schema.releaseJobTrigger} on ${schema.job.id} = ${schema.releaseJobTrigger.jobId}
    inner join ${schema.release} on ${schema.releaseJobTrigger.releaseId} = ${schema.release.id}
    inner join ${schema.deployment} on ${schema.release.deploymentId} = ${schema.deployment.id}
    where ${schema.job.status} = ${JobStatus.Pending}
  `;

  const jobsToCancelQuery = sql`
    select distinct triggers.jobIdToCancel
    from ${schema.releaseJobTrigger}
    inner join ${schema.release} on ${schema.releaseJobTrigger.releaseId} = ${schema.release.id}
    inner join ${schema.deployment} on ${schema.release.deploymentId} = ${schema.deployment.id}
    inner join ${schema.environment} on ${schema.releaseJobTrigger.environmentId} = ${schema.environment.id}
    left join ${schema.environmentPolicy} on ${schema.environment.policyId} = ${schema.environmentPolicy.id}
    inner join (${triggersSubquery}) as triggers on 
      ${schema.deployment.id} = triggers.cancelDeploymentId
      and ${schema.releaseJobTrigger.environmentId} = triggers.cancelEnvironmentId
      and ${schema.release.id} != triggers.cancelReleaseId
      and ${schema.release.createdAt} > triggers.cancelReleaseCreatedAt
    where ${inArray(
      schema.releaseJobTrigger.id,
      releaseJobTriggers.map((t) => t.id),
    )}
    and (
      ${schema.environmentPolicy.releaseSequencing} = ${schema.releaseSequencingType.enumValues.at(1)} 
      or ${isNull(schema.environmentPolicy.releaseSequencing)}
    )
  `;

  const jobsToCancel = await db
    .execute(jobsToCancelQuery)
    .then((r) => r.rows.map((r) => String(r.jobidtocancel)));

  await Promise.all(
    jobsToCancel.map((jobId) =>
      updateJob(db, jobId, { status: JobStatus.Cancelled }),
    ),
  );
};
