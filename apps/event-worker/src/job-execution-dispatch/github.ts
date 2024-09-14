import type { JobExecution } from "@ctrlplane/db/schema";
import { Queue } from "bullmq";
import ms from "ms";
import pRetry from "p-retry";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { githubOrganization, job } from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";
import { configSchema } from "@ctrlplane/validators/github";
import { JobExecutionStatus } from "@ctrlplane/validators/jobs";

import { convertStatus, getInstallationOctokit } from "../github-utils.js";
import { redis } from "../redis.js";

const jobExecutionSyncQueue = new Queue(Channel.JobExecutionSync, {
  connection: redis,
});

export const dispatchGithubJobExecution = async (je: JobExecution) => {
  console.log(`Dispatching job execution ${je.id}...`);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    await db.update(job).set({
      status: JobExecutionStatus.InvalidJobAgent,
      message: `Invalid job agent config for job execution ${je.id}: ${parsed.error.message}`,
    });
    return;
  }

  const ghOrg = await db
    .select()
    .from(githubOrganization)
    .where(
      and(
        eq(githubOrganization.installationId, parsed.data.installationId),
        eq(githubOrganization.organizationName, parsed.data.owner),
      ),
    )
    .then(takeFirstOrNull);

  if (ghOrg == null) {
    await db.update(job).set({
      status: JobExecutionStatus.InvalidIntegration,
      message: `GitHub organization not found for job execution ${je.id}`,
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

  const installationToken = (await octokit.auth({
    type: "installation",
    installationId: parsed.data.installationId,
  })) as { token: string };

  await octokit.actions.createWorkflowDispatch({
    owner: parsed.data.owner,
    repo: parsed.data.repo,
    workflow_id: parsed.data.workflowId,
    ref: ghOrg.branch,
    inputs: {
      job_id: je.id.slice(0, 8),
    },
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
      authorization: `Bearer ${installationToken.token}`,
    },
  });

  let runId: number | null = null;
  let status: string | null = null;

  try {
    const { runId: runId_, status: status_ } = await pRetry(
      async () => {
        const runs = await octokit.actions.listWorkflowRuns({
          owner: parsed.data.owner,
          repo: parsed.data.repo,
          workflow_id: parsed.data.workflowId,
          branch: ghOrg.branch,
        });

        const run = runs.data.workflow_runs.find((run) =>
          run.name?.includes(je.id.slice(0, 8)),
        );

        if (run == null) throw new Error("Run not found");

        return { runId: run.id, status: run.status };
      },
      { retries: 15, minTimeout: 1000 },
    );

    runId = runId_;
    status = status_;
  } catch (e) {
    await db.update(job).set({
      status: JobExecutionStatus.ExternalRunNotFound,
      message: `Run ID not found for job execution ${je.id}`,
    });
    return;
  }

  await db
    .update(job)
    .set({
      externalRunId: runId.toString(),
      status: convertStatus(status ?? JobExecutionStatus.Pending),
    })
    .where(eq(job.id, je.id));

  await jobExecutionSyncQueue.add(
    je.id,
    { jobExecutionId: je.id },
    { repeat: { every: ms("10s") } },
  );
};
