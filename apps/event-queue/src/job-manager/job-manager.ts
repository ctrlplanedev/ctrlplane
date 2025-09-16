import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";
import {
  exitedStatus,
  failedStatuses,
  JobAgentType,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import type { Workspace } from "../workspace/workspace.js";
import { dispatchGithubJob } from "./github.js";

export class JobManager {
  private log = logger.child({ module: "job-manager" });
  constructor(private workspace: Workspace) {}

  private getIsJobJustCompleted(previous: schema.Job, current: schema.Job) {
    const isPreviousStatusExited = exitedStatus.includes(
      previous.status as JobStatus,
    );
    const isCurrentStatusExited = exitedStatus.includes(
      current.status as JobStatus,
    );
    return !isPreviousStatusExited && isCurrentStatusExited;
  }

  private async getReleaseTarget(jobId: string) {
    const allReleaseJobs =
      await this.workspace.repository.releaseJobRepository.getAll();
    const releaseJob = allReleaseJobs.find((r) => r.jobId === jobId);
    if (releaseJob == null) return null;
    const release = await this.workspace.repository.releaseRepository.get(
      releaseJob.releaseId,
    );
    if (release == null) return null;
    const versionRelease =
      await this.workspace.repository.versionReleaseRepository.get(
        release.versionReleaseId,
      );
    if (versionRelease == null) return null;
    const releaseTarget =
      await this.workspace.repository.releaseTargetRepository.get(
        versionRelease.releaseTargetId,
      );
    return releaseTarget ?? null;
  }

  private async getReleaseFromJob(job: schema.Job) {
    const allReleaseJobs =
      await this.workspace.repository.releaseJobRepository.getAll();
    const releaseJob = allReleaseJobs.find((r) => r.jobId === job.id);
    if (releaseJob == null) return null;
    const release = await this.workspace.repository.releaseRepository.get(
      releaseJob.releaseId,
    );
    return release ?? null;
  }

  private async getNumJobsForRelease(
    release: typeof schema.release.$inferSelect,
  ) {
    const allReleaseJobs =
      await this.workspace.repository.releaseJobRepository.getAll();
    return allReleaseJobs.filter((r) => r.releaseId === release.id).length;
  }

  private async maybeRetryJob(
    releaseTarget: schema.ReleaseTarget,
    job: schema.Job,
  ) {
    const isJobFailed = failedStatuses.includes(job.status as JobStatus);
    if (!isJobFailed) return false;
    const policyTargets =
      await this.workspace.selectorManager.policyTargetReleaseTargetSelector.getSelectorsForEntity(
        releaseTarget,
      );
    const policyTargetIds = new Set(policyTargets.map((pt) => pt.policyId));

    const allPolicies =
      await this.workspace.repository.policyRepository.getAll();
    const matchedPolicies = allPolicies
      .filter((p) => policyTargetIds.has(p.id))
      .sort((a, b) => b.priority - a.priority);
    for (const policy of matchedPolicies) {
      const retryRule =
        await this.workspace.repository.versionRuleRepository.getRetryRule(
          policy.id,
        );
      if (retryRule == null) continue;

      const release = await this.getReleaseFromJob(job);
      if (release == null) return false;

      const numJobsForRelease = await this.getNumJobsForRelease(release);
      if (numJobsForRelease >= retryRule.maxRetries) return false;

      const newJob = await this.createReleaseJob(release);
      await this.dispatchJob(newJob);

      return true;
    }

    return false;
  }

  async updateJob(previous: schema.Job, current: schema.Job) {
    const updatedJob =
      await this.workspace.repository.jobRepository.update(current);
    if (!this.getIsJobJustCompleted(previous, updatedJob)) return;
    const releaseTarget = await this.getReleaseTarget(updatedJob.id);
    if (releaseTarget == null) return;

    const didRetry = await this.maybeRetryJob(releaseTarget, updatedJob);
    if (didRetry) return;

    await this.workspace.releaseTargetManager.evaluate(releaseTarget);
  }

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
    const snapshotIds = new Set(
      allValues
        .filter((v) => v.variableSetReleaseId === variableRelease.id)
        .map((v) => v.variableValueSnapshotId),
    );
    const allSnapshots =
      await this.workspace.repository.variableValueSnapshotRepository.getAll();
    const snapshots = allSnapshots.filter((s) => snapshotIds.has(s.id));
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

        await this.updateJob(job, updatedJob);
      }
    }
  }
}
