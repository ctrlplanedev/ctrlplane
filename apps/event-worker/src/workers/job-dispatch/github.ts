import type { Job } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { configSchema } from "@ctrlplane/validators/github";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { getInstallationOctokit } from "../../github-utils.js";

const log = logger.child({ module: "github-job-dispatch" });

const getGithubEntity = async (
  jobId: string,
  installationId: number,
  owner: string,
) => {
  const releaseGhEntityPromise = db
    .select()
    .from(SCHEMA.githubEntity)
    .innerJoin(
      SCHEMA.workspace,
      eq(SCHEMA.githubEntity.workspaceId, SCHEMA.workspace.id),
    )
    .innerJoin(
      SCHEMA.system,
      eq(SCHEMA.system.workspaceId, SCHEMA.workspace.id),
    )
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.environment.systemId, SCHEMA.system.id),
    )
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.environmentId, SCHEMA.environment.id),
    )
    .where(
      and(
        eq(SCHEMA.githubEntity.installationId, installationId),
        eq(SCHEMA.githubEntity.slug, owner),
        eq(SCHEMA.releaseJobTrigger.jobId, jobId),
      ),
    )
    .then(takeFirstOrNull);

  const runbookGhEntityPromise = db
    .select()
    .from(SCHEMA.githubEntity)
    .innerJoin(
      SCHEMA.workspace,
      eq(SCHEMA.githubEntity.workspaceId, SCHEMA.workspace.id),
    )
    .innerJoin(
      SCHEMA.system,
      eq(SCHEMA.system.workspaceId, SCHEMA.workspace.id),
    )
    .innerJoin(SCHEMA.runbook, eq(SCHEMA.runbook.systemId, SCHEMA.system.id))
    .innerJoin(
      SCHEMA.runbookJobTrigger,
      eq(SCHEMA.runbookJobTrigger.runbookId, SCHEMA.runbook.id),
    )
    .where(
      and(
        eq(SCHEMA.githubEntity.installationId, installationId),
        eq(SCHEMA.githubEntity.slug, owner),
        eq(SCHEMA.runbookJobTrigger.jobId, jobId),
      ),
    )
    .then(takeFirstOrNull);

  const releaseJobEntityPromise = db
    .select()
    .from(SCHEMA.releaseJob)
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
    )
    .innerJoin(
      SCHEMA.releaseTarget,
      eq(SCHEMA.release.releaseTargetId, SCHEMA.releaseTarget.id),
    )
    .innerJoin(
      SCHEMA.resource,
      eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
    )
    .innerJoin(
      SCHEMA.githubEntity,
      eq(SCHEMA.resource.workspaceId, SCHEMA.githubEntity.workspaceId),
    )
    .where(
      and(
        eq(SCHEMA.githubEntity.installationId, installationId),
        eq(SCHEMA.githubEntity.slug, owner),
        eq(SCHEMA.releaseJob.jobId, jobId),
      ),
    )
    .then(takeFirstOrNull);

  const [releaseGhEntityResult, runbookGhEntityResult, releaseJobEntityResult] =
    await Promise.all([
      releaseGhEntityPromise,
      runbookGhEntityPromise,
      releaseJobEntityPromise,
    ]);

  return (
    releaseGhEntityResult?.github_entity ??
    runbookGhEntityResult?.github_entity ??
    releaseJobEntityResult?.github_entity
  );
};

const getReleaseJobAgentConfig = (jobId: string) =>
  db
    .select({ jobAgentConfig: SCHEMA.deploymentVersion.jobAgentConfig })
    .from(SCHEMA.deploymentVersion)
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .where(eq(SCHEMA.releaseJobTrigger.jobId, jobId))
    .then(takeFirstOrNull)
    .then((r) => r?.jobAgentConfig);

export const dispatchGithubJob = async (je: Job) => {
  log.info(`Dispatching github job ${je.id}...`);

  const config = je.jobAgentConfig;
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    log.error(
      `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
    );
    await updateJob(db, je.id, {
      status: JobStatus.InvalidJobAgent,
      message: `Invalid job agent config for job ${je.id}: ${parsed.error.message}`,
    });
    return;
  }

  const { data: parsedConfig } = parsed;
  const releaseJobAgentConfig = await getReleaseJobAgentConfig(je.id);
  const mergedConfig = _.merge(parsedConfig, releaseJobAgentConfig);

  const ghEntity = await getGithubEntity(
    je.id,
    mergedConfig.installationId,
    mergedConfig.owner,
  );
  if (ghEntity == null) {
    log.error(`GitHub entity not found for job ${je.id}`);
    return updateJob(db, je.id, {
      status: JobStatus.InvalidIntegration,
      message: `GitHub entity not found for job ${je.id}`,
    });
  }

  const octokit = getInstallationOctokit(ghEntity.installationId);
  if (octokit == null) {
    log.error(`GitHub bot not configured for job ${je.id}`);
    return updateJob(db, je.id, {
      status: JobStatus.InvalidJobAgent,
      message: "GitHub bot not configured",
    });
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
    mergedConfig.ref ??
    (await octokit.rest.repos
      .get({ ...mergedConfig, headers })
      .then((r) => r.data.default_branch)
      .catch((e) => {
        logger.error(`Failed to get ref for github action job ${je.id}`, {
          error: e,
        });
        return null;
      }));

  if (ref == null) {
    log.error(`Failed to get ref for github action job ${je.id}`);
    return updateJob(db, je.id, {
      status: JobStatus.InvalidJobAgent,
      message: "Failed to get ref for github action job",
    });
  }

  log.info(`Creating workflow dispatch for job ${je.id}...`, {
    owner: mergedConfig.owner,
    repo: mergedConfig.repo,
    workflow_id: mergedConfig.workflowId,
    ref,
    inputs: { job_id: je.id },
  });

  try {
    await octokit.actions.createWorkflowDispatch({
      owner: mergedConfig.owner,
      repo: mergedConfig.repo,
      workflow_id: mergedConfig.workflowId,
      ref,
      inputs: { job_id: je.id },
      headers,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log.error(`Failed to create workflow dispatch for job ${je.id}`, {
      error,
    });
    return updateJob(db, je.id, {
      status: JobStatus.InvalidJobAgent,
      message: `Failed to dispatch github action job ${je.id}: ${error} to agent (installation: ${ghEntity.installationId}, owner: ${ghEntity.slug}, repo: ${mergedConfig.repo}, workflow: ${mergedConfig.workflowId}, ref: ${ref})`,
    });
  }
};
