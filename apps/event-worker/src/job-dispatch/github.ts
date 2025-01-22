import type { Job } from "@ctrlplane/db/schema";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  environment,
  githubEntity,
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

const getGithubEntity = async (
  jobId: string,
  installationId: number,
  owner: string,
) => {
  const releaseGhEntityPromise = db
    .select()
    .from(githubEntity)
    .innerJoin(workspace, eq(githubEntity.workspaceId, workspace.id))
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(environment, eq(environment.systemId, system.id))
    .innerJoin(
      releaseJobTrigger,
      eq(releaseJobTrigger.environmentId, environment.id),
    )
    .where(
      and(
        eq(githubEntity.installationId, installationId),
        eq(githubEntity.slug, owner),
        eq(releaseJobTrigger.jobId, jobId),
      ),
    )
    .then(takeFirstOrNull);

  const runbookGhEntityPromise = db
    .select()
    .from(githubEntity)
    .innerJoin(workspace, eq(githubEntity.workspaceId, workspace.id))
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(runbook, eq(runbook.systemId, system.id))
    .innerJoin(runbookJobTrigger, eq(runbookJobTrigger.runbookId, runbook.id))
    .where(
      and(
        eq(githubEntity.installationId, installationId),
        eq(githubEntity.slug, owner),
        eq(runbookJobTrigger.jobId, jobId),
      ),
    )
    .then(takeFirstOrNull);

  const [releaseGhEntityResult, runbookGhEntityResult] = await Promise.all([
    releaseGhEntityPromise,
    runbookGhEntityPromise,
  ]);

  return (
    releaseGhEntityResult?.github_entity ?? runbookGhEntityResult?.github_entity
  );
};

export const dispatchGithubJob = async (je: Job) => {
  logger.info(`Dispatching github job ${je.id}...`);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    logger.error(
      `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
    );
    await db
      .update(job)
      .set({
        status: JobStatus.InvalidJobAgent,
        message: `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
      })
      .where(eq(job.id, je.id));
    return;
  }

  const { data: parsedConfig } = parsed;

  const ghEntity = await getGithubEntity(
    je.id,
    parsedConfig.installationId,
    parsedConfig.owner,
  );
  if (ghEntity == null) {
    await db
      .update(job)
      .set({
        status: JobStatus.InvalidIntegration,
        message: `GitHub entity not found for job ${je.id}`,
      })
      .where(eq(job.id, je.id));
    return;
  }

  const octokit = getInstallationOctokit(ghEntity.installationId);
  if (octokit == null) {
    logger.error(`GitHub bot not configured for job ${je.id}`);
    await db
      .update(job)
      .set({
        status: JobStatus.InvalidJobAgent,
        message: "GitHub bot not configured",
      })
      .where(eq(job.id, je.id));
    return;
  }

  const installationToken = (await octokit.auth({
    type: "installation",
    installationId: parsedConfig.installationId,
  })) as { token: string };

  const headers = {
    "X-GitHub-Api-Version": "2022-11-28",
    authorization: `Bearer ${installationToken.token}`,
  };

  const ref =
    parsedConfig.ref ??
    (await octokit.rest.repos
      .get({ ...parsedConfig, headers })
      .then((r) => r.data.default_branch)
      .catch((e) => {
        logger.error(`Failed to get ref for github action job ${je.id}`, {
          error: e,
        });
        return null;
      }));

  if (ref == null) {
    logger.error(`Failed to get ref for github action job ${je.id}`);
    await db
      .update(job)
      .set({
        status: JobStatus.InvalidJobAgent,
        message: "Failed to get ref for github action job",
      })
      .where(eq(job.id, je.id));
    return;
  }

  logger.info(`Creating workflow dispatch for job ${je.id}...`, {
    owner: parsedConfig.owner,
    repo: parsedConfig.repo,
    workflow_id: parsedConfig.workflowId,
    ref,
    inputs: { job_id: je.id },
  });

  await octokit.actions.createWorkflowDispatch({
    owner: parsedConfig.owner,
    repo: parsedConfig.repo,
    workflow_id: parsedConfig.workflowId,
    ref,
    inputs: { job_id: je.id },
    headers,
  });
};
