import type { JobExecution } from "@ctrlplane/db/schema";
import pRetry from "p-retry";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobExecution } from "@ctrlplane/db/schema";
import { configSchema } from "@ctrlplane/validators/github";
import { JobExecutionStatus } from "@ctrlplane/validators/jobs";

import { convertStatus, getOctokit } from "../github-utils.js";

export const syncGithubJobExecution = async (je: JobExecution) => {
  const config = je.jobAgentConfig;
  configSchema.parse(config);

  const octokit = getOctokit();
  if (octokit == null) {
    await db.update(jobExecution).set({
      status: JobExecutionStatus.InvalidJobAgent,
      message: "GitHub bot not configured",
    });
    return;
  }

  const runId = await pRetry(
    async () => {
      const runs = await octokit.actions.listWorkflowRuns({
        owner: config.login,
        repo: config.repo,
        workflow_id: config.workflowId,
      });

      const run = runs.data.workflow_runs.find((run) =>
        run.name?.includes(je.id.slice(0, 8)),
      );

      return run?.id;
    },
    { retries: 15, minTimeout: 1000 },
  );

  if (runId == null) {
    await db.update(jobExecution).set({
      status: JobExecutionStatus.ExternalRunNotFound,
      message: `Run ID not found for job execution ${je.id}`,
    });
    return;
  }

  const { data: workflowState } = await octokit.actions.getWorkflowRun({
    owner: config.login,
    repo: config.repo,
    run_id: runId,
  });

  const status = convertStatus(
    workflowState.status ?? JobExecutionStatus.Pending,
  );

  await db
    .update(jobExecution)
    .set({ status })
    .where(eq(jobExecution.id, je.id));

  return status === JobExecutionStatus.Completed;
};
