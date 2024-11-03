import type { Job } from "@ctrlplane/db/schema";

import { and, eq, or, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  environment,
  githubOrganization,
  job,
  releaseJobTrigger,
  runbook,
  runbookJobTrigger,
  system,
  workspace,
} from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { configSchema } from "@ctrlplane/validators/github";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { getInstallationOctokit } from "../github-utils.js";

export const dispatchGithubJob = async (je: Job) => {
  logger.info(`Dispatching github job ${je.id}...`);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    logger.error(
      `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
    );
    await db.update(job).set({
      status: JobStatus.InvalidJobAgent,
      message: `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
    });
    return;
  }

  const ghOrgResult = await db
    .select()
    .from(githubOrganization)
    .innerJoin(workspace, eq(githubOrganization.workspaceId, workspace.id))
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .leftJoin(environment, eq(environment.systemId, system.id))
    .leftJoin(
      releaseJobTrigger,
      eq(releaseJobTrigger.environmentId, environment.id),
    )
    .leftJoin(runbook, eq(runbook.systemId, system.id))
    .leftJoin(runbookJobTrigger, eq(runbookJobTrigger.runbookId, runbook.id))
    .where(
      and(
        eq(githubOrganization.installationId, parsed.data.installationId),
        eq(githubOrganization.organizationName, parsed.data.owner),
        or(
          eq(releaseJobTrigger.jobId, je.id),
          eq(runbookJobTrigger.jobId, je.id),
        ),
      ),
    )
    .then(takeFirstOrNull);

  if (ghOrgResult == null) {
    await db.update(job).set({
      status: JobStatus.InvalidIntegration,
      message: `GitHub organization not found for job ${je.id}`,
    });
    return;
  }

  const ghOrg = ghOrgResult.github_organization;

  const octokit = getInstallationOctokit(parsed.data.installationId);
  if (octokit == null) {
    logger.error(`GitHub bot not configured for job ${je.id}`);
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

  logger.info(`Creating workflow dispatch for job ${je.id}...`, {
    owner: parsed.data.owner,
    repo: parsed.data.repo,
    workflow_id: parsed.data.workflowId,
    ref: ghOrg.branch,
    inputs: {
      job_id: je.id,
    },
  });

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
};
