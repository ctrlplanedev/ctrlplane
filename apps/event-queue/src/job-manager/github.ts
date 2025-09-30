import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import _ from "lodash";
import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { configSchema } from "@ctrlplane/validators/github";

import { env } from "../config.js";
import { createSpanWrapper } from "../traces.js";

const log = logger.child({ module: "job-dispatch-github" });

const getInstallationOctokit = (installationId: number) =>
  env.GITHUB_BOT_APP_ID &&
  env.GITHUB_BOT_PRIVATE_KEY &&
  env.GITHUB_BOT_CLIENT_ID &&
  env.GITHUB_BOT_CLIENT_SECRET
    ? new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: env.GITHUB_BOT_APP_ID,
          privateKey: env.GITHUB_BOT_PRIVATE_KEY,
          clientId: env.GITHUB_BOT_CLIENT_ID,
          clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
          installationId,
        },
      })
    : null;

const parseConfig = (jobId: string, config: unknown) => {
  const parsed = configSchema.safeParse(config);
  if (!parsed.success)
    throw new Error(
      `Invalid job agent config for job ${jobId}: ${parsed.error.message}`,
    );
  return parsed.data;
};

const getRunbookJob = async (job: schema.Job) =>
  db
    .select()
    .from(schema.runbookJobTrigger)
    .where(eq(schema.runbookJobTrigger.jobId, job.id))
    .then(takeFirstOrNull);

const getReleaseJob = async (
  job: schema.Job,
  config: z.infer<typeof configSchema>,
) =>
  db
    .select()
    .from(schema.releaseJob)
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.deploymentVersion,
      eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.githubEntity,
      eq(schema.resource.workspaceId, schema.githubEntity.workspaceId),
    )
    .where(
      and(
        eq(schema.githubEntity.installationId, config.installationId),
        eq(schema.githubEntity.slug, config.owner),
        eq(schema.releaseJob.jobId, job.id),
      ),
    )
    .then(takeFirstOrNull);

const getRef = async (
  octokit: Octokit,
  config: z.infer<typeof configSchema>,
  headers: Record<string, string>,
) => {
  if (config.ref != null) return config.ref;
  const repoResp = await octokit.repos.get({ ...config, headers });
  return repoResp.data.default_branch;
};

const handleJobDispatch = async (
  job: schema.Job,
  config: z.infer<typeof configSchema>,
  ghEntity: schema.GithubEntity,
) => {
  const octokit = getInstallationOctokit(ghEntity.installationId);
  if (octokit == null)
    throw new Error(`GitHub bot not configured for job ${job.id}`);

  const tokenSchema = z.object({ token: z.string() });
  const authResp = await octokit.auth({
    type: "installation",
    installationId: config.installationId,
  });
  const { token } = tokenSchema.parse(authResp);
  const headers = {
    "X-GitHub-Api-Version": "2022-11-28",
    authorization: `Bearer ${token}`,
  };
  const ref = await getRef(octokit, config, headers);

  log.info(`Dispatching github job ${job.id} to github`, {
    owner: config.owner,
    repo: config.repo,
    workflow_id: config.workflowId,
    ref,
    inputs: { job_id: job.id },
  });

  await octokit.actions.createWorkflowDispatch({
    owner: config.owner,
    repo: config.repo,
    workflow_id: config.workflowId,
    ref,
    inputs: { job_id: job.id },
    headers,
  });
};

export const dispatchGithubJob = createSpanWrapper(
  "dispatch-github-job",
  async (_span, job: schema.Job) => {
    log.info(`Dispatching github job ${job.id}...`);

    const config = job.jobAgentConfig;
    const parsed = parseConfig(job.id, config);
    const releaseJob = await getReleaseJob(job, parsed);
    if (releaseJob != null) {
      const { jobAgentConfig } = releaseJob.deployment_version;
      const mergedConfig = _.merge(config, jobAgentConfig);

      const parsedMergedConfig = parseConfig(job.id, mergedConfig);
      return handleJobDispatch(
        job,
        parsedMergedConfig,
        releaseJob.github_entity,
      );
    }

    const runbookJob = await getRunbookJob(job);
    if (runbookJob != null) {
      log.info(`Dispatching github job ${job.id} to runbook`);
      return;
    }

    throw new Error(`Unknown job type for job ${job.id}`);
  },
);
