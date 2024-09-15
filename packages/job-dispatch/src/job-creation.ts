import type { Tx } from "@ctrlplane/db";
import type { Job, JobStatus, ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, inArray, isNotNull, or, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyDeployment,
  job,
  jobAgent,
  release,
  releaseDependency,
  releaseJobTrigger,
} from "@ctrlplane/db/schema";
/**
 * Converts a job config into a job which means they can now be
 * picked up by job agents
 */
import { logger } from "@ctrlplane/logger";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

export const createTriggeredReleaseJobs = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
  status: JobStatus = "pending",
): Promise<Job[]> => {
  logger.info(`Creating triggered release jobs`, {
    releaseJobTriggersCount: releaseJobTriggers.length,
    status,
  });

  const insertJobs = await db
    .select()
    .from(releaseJobTrigger)
    .leftJoin(release, eq(release.id, releaseJobTrigger.releaseId))
    .leftJoin(deployment, eq(deployment.id, release.deploymentId))
    .innerJoin(jobAgent, eq(jobAgent.id, deployment.jobAgentId))
    .where(
      inArray(
        releaseJobTrigger.id,
        releaseJobTriggers.map((t) => t.id),
      ),
    );

  logger.debug(`Found jobs to insert`, { count: insertJobs.length });

  if (insertJobs.length === 0) {
    logger.info(`No jobs to insert, returning empty array`);
    return [];
  }

  const jobs = await db
    .insert(job)
    .values(
      insertJobs.map((d) => ({
        releaseJobTriggerId: d.release_job_trigger.id,
        jobAgentId: d.job_agent.id,
        jobAgentConfig: _.merge(
          d.job_agent.config,
          d.deployment?.jobAgentConfig ?? {},
        ),
        status,
      })),
    )
    .returning();

  logger.info(`Inserted jobs`, { count: jobs.length });

  // Update releaseJobTrigger with the new job ids
  await Promise.all(
    jobs.map((job, index) =>
      db
        .update(releaseJobTrigger)
        .set({ jobId: job.id })
        .where(
          eq(releaseJobTrigger.id, insertJobs[index]!.release_job_trigger.id),
        ),
    ),
  );

  logger.info(`Updated releaseJobTrigger with new job ids`);

  return jobs;
};

/**
 * When a job completes, there may be other jobs that should now be triggered
 * because the completion of this job means that some policies are now passing.
 *
 * criteria requirement - "need n from QA to pass before deploying to staging"
 * wait requirement - "in the same environment, need to wait for previous release to be deployed first"
 * concurrency requirement - "only n releases in staging at a time"
 * version dependency - "need to wait for deployment X version Y to be deployed first"
 *
 *
 * This function looks at the job's release and deployment and finds all the
 * other release that should be triggered and dispatches them.
 *
 * @param je
 */
export const onJobCompletion = async (je: Job) => {
  const triggers = await db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(deployment, eq(release.deploymentId, deployment.id))
    .where(eq(releaseJobTrigger.jobId, je.id))
    .then(takeFirst);

  const affectedReleaseJobTriggers = await db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .leftJoin(
      environmentPolicyDeployment,
      eq(environmentPolicyDeployment.policyId, environmentPolicy.id),
    )
    .leftJoin(
      releaseDependency,
      and(
        eq(releaseDependency.releaseId, releaseJobTrigger.releaseId),
        eq(releaseDependency.deploymentId, triggers.deployment.id),
      ),
    )
    .where(
      and(
        eq(job.status, "triggered"),
        or(
          // this release has a criteria requirement, i.e. "n from QA need to pass"
          // and the completed job is part of the environment that needs to pass
          and(
            eq(releaseJobTrigger.releaseId, triggers.release.id),
            eq(
              environmentPolicyDeployment.environmentId,
              triggers.environment.id,
            ),
          ),
          // this release is waiting on previous releases in the same environment to finish,
          // and the completed job is part of this environment
          and(
            eq(environmentPolicy.releaseSequencing, "wait"),
            eq(environment.id, triggers.environment.id),
          ),
          // this release and environment has a concurrency requirement,
          // and the completed job is part of this environment and release
          and(
            eq(environmentPolicy.concurrencyType, "some"),
            eq(environment.id, triggers.environment.id),
            eq(releaseJobTrigger.releaseId, triggers.release.id),
          ),
          // this release has a version dependency on another deployment,
          // and the completed job is part of a release in that other deployment
          isNotNull(releaseDependency.id),
        ),
      ),
    );

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(
      affectedReleaseJobTriggers.map((t) => t.release_job_trigger),
    )
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};
