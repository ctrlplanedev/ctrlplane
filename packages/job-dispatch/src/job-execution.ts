import type { Tx } from "@ctrlplane/db";
import type { JobConfig, JobExecution } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, inArray, isNull, or, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyDeployment,
  jobAgent,
  jobConfig,
  jobExecution,
  release,
  runbook,
} from "@ctrlplane/db/schema";

import { dispatchJobConfigs } from "./job-dispatch.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { cancelOldJobConfigsOnJobDispatch } from "./release-sequencing.js";

type JobExecutionStatusType =
  | "completed"
  | "cancelled"
  | "skipped"
  | "in_progress"
  | "action_required"
  | "pending"
  | "failure"
  | "invalid_job_agent";

export type JobExecutionReason =
  | "policy_passing"
  | "policy_override"
  | "env_policy_override"
  | "config_policy_override";

/**
 * Converts a job config into a job execution which means they can now be
 * picked up by job agents
 */
export const createJobExecutions = async (
  db: Tx,
  jobConfigs: JobConfig[],
  status: JobExecutionStatusType = "pending",
  reason?: JobExecutionReason,
): Promise<JobExecution[]> => {
  const insertJobExecutions = await db
    .select()
    .from(jobConfig)
    .leftJoin(release, eq(release.id, jobConfig.releaseId))
    .leftJoin(deployment, eq(deployment.id, release.deploymentId))
    .leftJoin(runbook, eq(runbook.id, jobConfig.runbookId))
    .innerJoin(
      jobAgent,
      or(
        eq(jobAgent.id, deployment.jobAgentId),
        eq(jobAgent.id, runbook.jobAgentId),
      ),
    )
    .where(
      inArray(
        jobConfig.id,
        jobConfigs.map((t) => t.id),
      ),
    )
    .then((ds) =>
      ds.map((d) => ({
        jobConfigId: d.job_config.id,
        jobAgentId: d.job_agent.id,
        jobAgentConfig: _.merge(
          d.job_agent.config,
          d.deployment?.jobAgentConfig ?? {},
          d.runbook?.jobAgentConfig ?? {},
        ),
        status,
        reason,
      })),
    );

  if (insertJobExecutions.length === 0) return [];

  const jobExecutions = await db
    .insert(jobExecution)
    .values(insertJobExecutions)
    .returning();

  return jobExecutions;
};

export const onJobExecutionStatusChange = async (je: JobExecution) => {
  if (je.status === "completed") {
    const config = await db
      .select()
      .from(jobConfig)
      .innerJoin(release, eq(jobConfig.releaseId, release.id))
      .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
      .where(eq(jobConfig.id, je.jobConfigId))
      .then(takeFirst);

    const affectedJobConfigs = await db
      .select()
      .from(jobConfig)
      .leftJoin(jobExecution, eq(jobExecution.jobConfigId, jobConfig.id))
      .innerJoin(release, eq(jobConfig.releaseId, release.id))
      .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
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
          isNull(jobExecution.jobConfigId),
          isNull(jobConfig.runbookId),
          isNull(environment.deletedAt),
          or(
            and(
              eq(jobConfig.releaseId, config.release.id),
              eq(
                environmentPolicyDeployment.environmentId,
                config.environment.id,
              ),
            ),
            and(
              eq(environmentPolicy.releaseSequencing, "wait"),
              eq(environment.id, config.environment.id),
            ),
          ),
        ),
      );

    await dispatchJobConfigs(db)
      .jobConfigs(affectedJobConfigs.map((t) => t.job_config))
      .filter(isPassingAllPolicies)
      .then(cancelOldJobConfigsOnJobDispatch)
      .dispatch();
  }
};
