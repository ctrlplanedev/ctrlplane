import type { Tx } from "@ctrlplane/db";
import type {
  Environment,
  JobAgent,
  JobConfig,
  JobExecution,
  Release,
  Runbook,
  Target,
  updateJobExecution,
} from "@ctrlplane/db/schema";
import _ from "lodash";
import { z } from "zod";

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

import { dispatchJobConfigs } from "./job-dispatch";
import { isPassingAllPolicies } from "./policy-checker";
import { cancelOldJobConfigsOnJobDispatch } from "./release-sequencing";

export const jobExecutionData = z.object({
  id: z.string().uuid(),
  config: z.record(z.any()),
  payload: z
    .object({
      jobExecution: z
        .object({
          id: z.string().uuid(),
        })
        .passthrough(),
      jobAgent: z
        .object({
          id: z.string().uuid(),
        })
        .passthrough(),
    })
    .passthrough(),
});

export interface JobExecutionData<T extends object = Record<string, unknown>> {
  id: string;
  jobAgentConfig: T;
  payload: {
    environment: Environment | null;
    target: Target | null;
    release: Release | null;
    runbook: Runbook | null;
    jobExecution: JobExecution;
    jobAgent: JobAgent;
  };
}

export type JobExecutionState = z.infer<typeof updateJobExecution>;

export const jobExecutionDataMapper = (d: {
  job_execution: JobExecution;
  target: Target | null;
  job_agent: JobAgent;
  environment: Environment | null;
  release: Release | null;
  runbook: Runbook | null;
}): JobExecutionData<any> => ({
  ...d.job_execution,
  payload: {
    jobAgent: d.job_agent,
    environment: d.environment,
    target: d.target,
    release: d.release,
    runbook: d.runbook,
    jobExecution: d.job_execution,
  },
});

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
 * Converts a job config into a jobExecution which means they can now be
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
