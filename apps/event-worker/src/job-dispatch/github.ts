import type { Job } from "@ctrlplane/db/schema";
import pRetry from "p-retry";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { githubOrganization, job } from "@ctrlplane/db/schema";
import { configSchema } from "@ctrlplane/validators/github";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { convertStatus, getInstallationOctokit } from "../github-utils.js";

export const dispatchGithubJob = async (je: Job) => {
  console.log(`Dispatching job ${je.id}...`);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    await db.update(job).set({
      status: JobStatus.InvalidJobAgent,
      message: `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
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
      status: JobStatus.InvalidIntegration,
      message: `GitHub organization not found for job ${je.id}`,
    });
    return;
  }

  const octokit = getInstallationOctokit(parsed.data.installationId);
  if (octokit == null) {
    await db.update(job).set({
      status: JobStatus.InvalidJobAgent,
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
      job_id: je.id,
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
          run.name?.includes(je.id),
        );

        if (run == null) throw new Error("Run not found");

        return { runId: run.id, status: run.status };
      },
      { retries: 15, minTimeout: 1000 },
    );

    runId = runId_;
    status = status_;
  } catch {
    await db.update(job).set({
      status: JobStatus.ExternalRunNotFound,
      message: `Run ID not found for job ${je.id}`,
    });
    return;
  }

  console.log(`>>> runId: ${runId}, status: ${status}`);

  await db
    .update(job)
    .set({
      externalId: runId.toString(),
      status: convertStatus(status ?? JobStatus.InProgress),
    })
    .where(eq(job.id, je.id));
};
