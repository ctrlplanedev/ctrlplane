import type * as schema from "@ctrlplane/db/schema";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import _ from "lodash";
import { z } from "zod";

import { logger } from "@ctrlplane/logger";
import { configSchema } from "@ctrlplane/validators/github";

import type { Workspace } from "../workspace/workspace.js";
import type { JobDispatcher } from "./job-dispatcher.js";
import { env } from "../config.js";
import { Trace } from "../traces.js";

const log = logger.child({ module: "job-dispatch-github" });

export class GithubDispatcher implements JobDispatcher {
  constructor(private workspace: Workspace) {}

  @Trace()
  private getInstallationOctokit(installationId: number) {
    if (
      env.GITHUB_BOT_APP_ID == null ||
      env.GITHUB_BOT_PRIVATE_KEY == null ||
      env.GITHUB_BOT_CLIENT_ID == null ||
      env.GITHUB_BOT_CLIENT_SECRET == null
    )
      return null;
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_BOT_APP_ID,
        privateKey: env.GITHUB_BOT_PRIVATE_KEY,
        clientId: env.GITHUB_BOT_CLIENT_ID,
        clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
        installationId,
      },
    });
  }

  private parseConfig(job: schema.Job, config: unknown) {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success)
      throw new Error(
        `Invalid job agent config for job ${job.id}: ${parsed.error.message}`,
      );
    return parsed.data;
  }

  @Trace()
  private async getGithubEntity(
    job: schema.Job,
    config: z.infer<typeof configSchema>,
  ) {
    const allGhEntities =
      await this.workspace.repository.githubEntityRepository.getAll();
    const ghEntity = allGhEntities.find(
      (e) =>
        e.installationId === config.installationId && e.slug === config.owner,
    );
    if (ghEntity == null)
      throw new Error(`Github entity not found for job ${job.id}`);
    return ghEntity;
  }

  @Trace()
  private async getRef(
    octokit: Octokit,
    config: z.infer<typeof configSchema>,
    headers: Record<string, string>,
  ) {
    if (config.ref != null) return config.ref;
    const repoResp = await octokit.repos.get({ ...config, headers });
    return repoResp.data.default_branch;
  }

  @Trace()
  private async sendToGithub(
    job: schema.Job,
    config: z.infer<typeof configSchema>,
    ghEntity: schema.GithubEntity,
  ) {
    const octokit = this.getInstallationOctokit(ghEntity.installationId);
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
    const ref = await this.getRef(octokit, config, headers);

    log.info(`Dispatching github job ${job.id} to github`, {
      owner: config.owner,
      repo: config.repo,
      workflow_id: config.workflowId,
      ref,
      inputs: { job_id: job.id },
    });

    // await octokit.actions.createWorkflowDispatch({
    //   owner: config.owner,
    //   repo: config.repo,
    //   workflow_id: config.workflowId,
    //   ref,
    //   inputs: { job_id: job.id },
    //   headers,
    // });
  }

  @Trace()
  async dispatchJob(job: schema.Job) {
    const config = this.parseConfig(job, job.jobAgentConfig);
    const ghEntity = await this.getGithubEntity(job, config);
    await this.sendToGithub(job, config, ghEntity);
  }
}
