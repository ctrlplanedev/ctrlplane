import type { Tx } from "@ctrlplane/db";
import type { Job, JobStatus, ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, inArray, isNull, or, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyDeployment,
  job,
  jobAgent,
  release,
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

  logger.debug(`Found jobs to insert`, {
    count: insertJobs.length,
  });

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

export const onJobStatusChange = async (je: Job) => {
  if (je.status === "completed") {
    const triggers = await db
      .select()
      .from(releaseJobTrigger)
      .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
      .innerJoin(
        environment,
        eq(releaseJobTrigger.environmentId, environment.id),
      )
      .where(eq(releaseJobTrigger.jobId, je.id))
      .then(takeFirst);

    const affectedReleaseJobTriggers = await db
      .select()
      .from(releaseJobTrigger)
      .leftJoin(job, eq(job.id, releaseJobTrigger.jobId))
      .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
      .innerJoin(
        environment,
        eq(releaseJobTrigger.environmentId, environment.id),
      )
      .innerJoin(
        environmentPolicy,
        eq(environment.policyId, environmentPolicy.id),
      )
      .innerJoin(
        environmentPolicyDeployment,
        eq(environmentPolicyDeployment.policyId, environmentPolicy.id),
      )
      .where(
        and(
          isNull(releaseJobTrigger.jobId),
          isNull(environment.deletedAt),
          or(
            and(
              eq(releaseJobTrigger.releaseId, triggers.release.id),
              eq(
                environmentPolicyDeployment.environmentId,
                triggers.environment.id,
              ),
            ),
            and(
              eq(environmentPolicy.releaseSequencing, "wait"),
              eq(environment.id, triggers.environment.id),
            ),
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
  }
};
