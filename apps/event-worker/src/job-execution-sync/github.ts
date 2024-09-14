import type { Job } from "@ctrlplane/db/schema";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { job } from "@ctrlplane/db/schema";
import { configSchema } from "@ctrlplane/validators/github";
import { JobExecutionStatus } from "@ctrlplane/validators/jobs";

import { convertStatus, getInstallationOctokit } from "../github-utils.js";

export const syncGithubJobExecution = async (je: Job) => {
  if (je.externalRunId == null) {
    await db.update(job).set({
      status: JobExecutionStatus.ExternalRunNotFound,
      message: `Run ID not found for job execution ${je.id}`,
    });
    return;
  }

  const runId = Number(je.externalRunId);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);

  if (!parsed.success) {
    await db.update(job).set({
      status: JobExecutionStatus.InvalidJobAgent,
      message: parsed.error.message,
    });
    return;
  }

  const octokit = getInstallationOctokit(parsed.data.installationId);
  if (octokit == null) {
    await db.update(job).set({
      status: JobExecutionStatus.InvalidJobAgent,
      message: "GitHub bot not configured",
    });
    return;
  }

  const { data: workflowState } = await octokit.actions.getWorkflowRun({
    owner: parsed.data.owner,
    repo: parsed.data.repo,
    run_id: runId,
  });

  const status = convertStatus(
    workflowState.status ?? JobExecutionStatus.Pending,
  );

  await db.update(job).set({ status }).where(eq(job.id, je.id));

  return status === JobExecutionStatus.Completed;
};
