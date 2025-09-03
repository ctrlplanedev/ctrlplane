import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { dispatchJobUpdated } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { JobAgentType, JobStatus } from "@ctrlplane/validators/jobs";

import type { Workspace } from "../workspace/workspace.js";
import { dispatchGithubJob } from "./github.js";

export class JobManager {
  private log = logger.child({ module: "job-manager" });
  constructor(private workspace: Workspace) {}

  private async getJobAgentWithConfig(
    versionRelease: typeof schema.versionRelease.$inferSelect,
  ) {
    const version = await this.workspace.repository.versionRepository.get(
      versionRelease.versionId,
    );
    if (version == null)
      throw new Error(`Version ${versionRelease.versionId} not found`);

    const deployment = await this.workspace.repository.deploymentRepository.get(
      version.deploymentId,
    );
    if (deployment == null)
      throw new Error(`Deployment ${version.deploymentId} not found`);
    if (deployment.jobAgentId == null)
      throw new Error(`Deployment ${version.deploymentId} has no job agent`);

    const jobAgent = await this.workspace.repository.jobAgentRepository.get(
      deployment.jobAgentId,
    );
    if (jobAgent == null)
      throw new Error(`Job agent ${deployment.jobAgentId} not found`);

    return {
      jobAgent,
      jobAgentConfig: _.merge(jobAgent.config, deployment.jobAgentConfig),
    };
  }

  private async createJob(
    jobAgentId: string,
    jobAgentConfig: Record<string, any>,
  ) {
    return this.workspace.repository.jobRepository.create({
      id: crypto.randomUUID(),
      jobAgentId,
      jobAgentConfig,
      status: JobStatus.Pending,
      message: null,
      externalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      reason: "policy_passing",
      startedAt: null,
      completedAt: null,
    });
  }

  private async createJobVariables(
    jobId: string,
    variableRelease: typeof schema.variableSetRelease.$inferSelect,
  ) {
    const allValues =
      await this.workspace.repository.variableReleaseValueRepository.getAll();
    const valueIds = new Set(
      allValues
        .filter((v) => v.variableSetReleaseId === variableRelease.id)
        .map((v) => v.id),
    );
    const allSnapshots =
      await this.workspace.repository.variableValueSnapshotRepository.getAll();
    const snapshots = allSnapshots.filter((s) => valueIds.has(s.id));
    return Promise.all(
      snapshots.map((s) =>
        this.workspace.repository.jobVariableRepository.create({
          id: crypto.randomUUID(),
          jobId,
          key: s.key,
          value: s.value,
          sensitive: s.sensitive,
        }),
      ),
    );
  }

  async createReleaseJob(release: typeof schema.release.$inferSelect) {
    const versionRelease =
      await this.workspace.repository.versionReleaseRepository.get(
        release.versionReleaseId,
      );
    if (versionRelease == null)
      throw new Error(`Version release ${release.versionReleaseId} not found`);

    const { jobAgent, jobAgentConfig } =
      await this.getJobAgentWithConfig(versionRelease);
    const job = await this.createJob(jobAgent.id, jobAgentConfig);

    const variableRelease =
      await this.workspace.repository.variableReleaseRepository.get(
        release.variableReleaseId,
      );
    if (variableRelease == null)
      throw new Error(
        `Variable release ${release.variableReleaseId} not found`,
      );

    await this.createJobVariables(job.id, variableRelease);
    await this.workspace.repository.releaseJobRepository.create({
      id: crypto.randomUUID(),
      releaseId: release.id,
      jobId: job.id,
    });

    return job;
  }

  async dispatchJob(job: schema.Job) {
    const jobAgentId = job.jobAgentId;
    if (jobAgentId == null) {
      this.log.info(`Job ${job.id} has no job agent, skipping dispatch`);
      return;
    }

    const jobAgent =
      await this.workspace.repository.jobAgentRepository.get(jobAgentId);
    if (jobAgent == null) throw new Error(`Job agent ${jobAgentId} not found`);

    if (jobAgent.type === String(JobAgentType.GithubApp)) {
      try {
        this.log.info(`Dispatching job ${job.id} to GitHub app`);
        await dispatchGithubJob(job);
      } catch (error: any) {
        this.log.error(`Error dispatching job ${job.id} to GitHub app`, {
          error: error.message,
        });

        const updatedJob = await this.workspace.repository.jobRepository.update(
          {
            ...job,
            status: JobStatus.InvalidIntegration,
            message: `Error dispatching job to GitHub app: ${error.message}`,
          },
        );

        await dispatchJobUpdated(job, updatedJob, this.workspace.id);
      }
    }
  }
}
