import type { JobExecution, JobExecutionStatus } from "@ctrlplane/db/schema";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { CronJob } from "cron";
import pRetry from "p-retry";
import { z } from "zod";

import { api } from "./api";
import { env } from "./config";

const configSchema = z.object({
  installationId: z.number(),
  login: z.string().min(1),
  repo: z.string().min(1),
  workflowId: z.number(),
});

const convertStatus = (status: string): JobExecutionStatus => {
  if (status === "success" || status === "neutral") return "completed";
  if (status === "queued" || status === "requested" || status === "waiting")
    return "pending";
  if (status === "timed_out" || status === "stale") return "failure";
  return status as JobExecutionStatus;
};

const dispatchGithubJobExecution = async (jobExecution: JobExecution) => {
  console.log(`Dispatching job execution ${jobExecution.id}...`);

  const config = jobExecution.jobAgentConfig;
  configSchema.parse(config);

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_BOT_APP_ID,
      privateKey: env.GITHUB_BOT_PRIVATE_KEY,
      clientId: env.GITHUB_BOT_CLIENT_ID,
      clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
      installationId: config.installationId,
    },
  });

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
      job_execution_id: jobExecution.id.slice(0, 8),
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
        run.name?.includes(jobExecution.id.slice(0, 8)),
      );

      return { runId: run?.id, status: run?.status };
    },
    { retries: 15, minTimeout: 1000 },
  );

  if (runId == null) {
    console.error(`Run ID not found for job execution ${jobExecution.id}`);
    return;
  }

  await api.job.execution.update.mutate({
    id: jobExecution.id,
    data: {
      externalRunId: runId.toString(),
      status: convertStatus(status ?? "pending"),
    },
  });
};

const updateJobExecutionStatus = async (jobExecution: JobExecution) => {
  const config = jobExecution.jobAgentConfig;
  configSchema.parse(config);

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_BOT_APP_ID,
      privateKey: env.GITHUB_BOT_PRIVATE_KEY,
      clientId: env.GITHUB_BOT_CLIENT_ID,
      clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
      installationId: config.installationId,
    },
  });

  const runId = await pRetry(
    async () => {
      const runs = await octokit.actions.listWorkflowRuns({
        owner: config.login,
        repo: config.repo,
        workflow_id: config.workflowId,
      });

      const run = runs.data.workflow_runs.find((run) =>
        run.name?.includes(jobExecution.id.slice(0, 8)),
      );

      return run?.id;
    },
    { retries: 15, minTimeout: 1000 },
  );

  if (runId == null) {
    console.error(`Run ID not found for job execution ${jobExecution.id}`);
    return;
  }

  const { data: workflowState } = await octokit.actions.getWorkflowRun({
    owner: config.login,
    repo: config.repo,
    run_id: runId,
  });

  const status = convertStatus(workflowState.status ?? "pending");

  return api.job.execution.update.mutate({
    id: jobExecution.id,
    data: { status },
  });
};

const run = async () => {
  console.log("Running job agent...");

  const githubAgents = await api.job.agent.byType.query("github-app");

  console.log(`[*] Found ${githubAgents.length} GitHub job agent(s) to run.`);

  await Promise.allSettled(
    githubAgents.map(async (jobAgent) => {
      const jobExecutions = await api.job.execution.list.byAgentId.query(
        jobAgent.id,
      );
      return Promise.allSettled(
        jobExecutions
          .filter((jobExecution) => jobExecution.status !== "completed")
          .map((jobExecution) =>
            jobExecution.externalRunId == null
              ? dispatchGithubJobExecution(jobExecution)
              : updateJobExecutionStatus(jobExecution),
          ),
      );
    }),
  );
};

const job = new CronJob(env.CRON_TIME, run, null, true);

console.log("Starting cron job...");

run().catch(console.error);
job.start();
