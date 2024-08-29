import { Queue } from "bullmq";
import ms from "ms";
import pRetry from "p-retry";

import { db } from "@ctrlplane/db/client";
import { jobExecution, JobExecution } from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";

import { configSchema, convertStatus, getOctokit } from "../github-utils.js";
import { redis } from "../redis.js";

const jobExecutionSyncQueue = new Queue(Channel.JobExecutionSync, {
  connection: redis,
});

export const dispatchGithubJobExecution = async (je: JobExecution) => {
  console.log(`Dispatching job execution ${je.id}...`);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);
  if (!parsed.success)
    throw new Error(`Invalid job agent config for job execution ${je.id}`);

  const octokit = getOctokit();
  if (octokit == null) throw new Error("GitHub bot not configured");

  const installationToken = (await octokit.auth({
    type: "installation",
    installationId: config.installationId,
  })) as { token: string };

  await octokit.actions.createWorkflowDispatch({
    owner: config.login,
    repo: config.repo,
    workflow_id: config.workflowId,
    ref: "main",
    inputs: {
      job_execution_id: je.id.slice(0, 8),
    },
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
      authorization: `Bearer ${installationToken.token}`,
    },
  });

  const { runId, status } = await pRetry(
    async () => {
      const runs = await octokit.actions.listWorkflowRuns({
        owner: config.login,
        repo: config.repo,
        workflow_id: config.workflowId,
      });

      const run = runs.data.workflow_runs.find((run) =>
        run.name?.includes(je.id.slice(0, 8)),
      );

      return { runId: run?.id, status: run?.status };
    },
    { retries: 15, minTimeout: 1000 },
  );

  if (runId == null)
    throw new Error(`Run ID not found for job execution ${je.id}`);

  await db.update(jobExecution).set({
    externalRunId: runId.toString(),
    status: convertStatus(status ?? "pending"),
  });

  await jobExecutionSyncQueue.add(
    je.id,
    { jobExecutionId: je.id },
    { repeat: { every: ms("10s") } },
  );
};
