import _ from "lodash";

import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import {
  exitedStatus,
  JobAgentType,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import type { Workspace } from "../workspace/workspace.js";
import { Trace } from "../traces.js";
import { GithubDispatcher } from "./github.js";

export class JobManager {
  private log = logger.child({ module: "job-manager" });
  constructor(private workspace: Workspace) {}

  @Trace()
  private getIsJobJustCompleted(previous: schema.Job, current: schema.Job) {
    const isPreviousStatusExited = exitedStatus.includes(
      previous.status as JobStatus,
    );
    const isCurrentStatusExited = exitedStatus.includes(
      current.status as JobStatus,
    );
    return !isPreviousStatusExited && isCurrentStatusExited;
  }

  @Trace()
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

  // private async maybeRetryJob(
  //   releaseTarget: schema.ReleaseTarget,
  //   job: schema.Job,
  // ) {
  //   const isJobFailed = failedStatuses.includes(job.status as JobStatus);
  //   if (!isJobFailed) return false;
  //   const policyTargets =
  //     await this.workspace.selectorManager.policyTargetReleaseTargetSelector.getSelectorsForEntity(
  //       releaseTarget,
  //     );
  //   const policyTargetIds = new Set(policyTargets.map((pt) => pt.policyId));

  //   const allPolicies =
  //     await this.workspace.repository.policyRepository.getAll();
  //   const matchedPolicies = allPolicies
  //     .filter((p) => policyTargetIds.has(p.id))
  //     .sort((a, b) => b.priority - a.priority);
  //   for (const policy of matchedPolicies) {
  //     const retryRule =
  //       await this.workspace.repository.versionRuleRepository.getRetryRule(
  //         policy.id,
  //       );
  //     if (retryRule == null) continue;

  //     const release = await this.getReleaseFromJob(job);
  //     if (release == null) return false;

  //     const numJobsForRelease = await this.getNumJobsForRelease(release);
  //     if (numJobsForRelease >= retryRule.maxRetries) return false;

  //     const newJob = await this.createReleaseJob(release);
  //     await this.dispatchJob(newJob);

  //     return true;
  //   }

  //   return false;
  // }

  @Trace()
  async updateJob(previous: schema.Job, current: schema.Job) {
    const updatedJob =
      await this.workspace.repository.jobRepository.update(current);
    if (!this.getIsJobJustCompleted(previous, updatedJob)) return;
    const releaseTarget = await this.getReleaseTarget(updatedJob.id);
    if (releaseTarget == null) return;

    await this.workspace.releaseTargetManager.evaluate(releaseTarget);
  }

  @Trace()
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

  @Trace()
  private async createJobInRepo(
    jobAgentId: string,
    jobAgentConfig: Record<string, any>,
  ) {
    return this.workspace.repository.jobRepository.create({
      id: crypto.randomUUID(),
      jobAgentId,
      jobAgentConfig,
      status: JobStatus.Pending,
      reason: "policy_passing",
      createdAt: new Date(),
      externalId: null,
      message: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    });
  }

  @Trace()
  private async createJobVariablesInRepo(
    jobId: string,
    jobVariables: {
      id: string;
      key: string;
      value: any;
      sensitive: boolean;
    }[],
  ) {
    return Promise.all(
      jobVariables.map((v) =>
        this.workspace.repository.jobVariableRepository.create({
          ...v,
          jobId,
        }),
      ),
    );
  }

  @Trace()
  private async createReleaseJobInRepo(releaseId: string, jobId: string) {
    return this.workspace.repository.releaseJobRepository.create({
      id: crypto.randomUUID(),
      releaseId,
      jobId,
    });
  }

  @Trace()
  private async createJob(
    releaseId: string,
    jobAgentId: string,
    jobAgentConfig: Record<string, any>,
    jobVariables: {
      id: string;
      key: string;
      value: any;
      sensitive: boolean;
    }[],
  ) {
    try {
      const job = await this.createJobInRepo(jobAgentId, jobAgentConfig);
      if (jobVariables.length > 0)
        await this.createJobVariablesInRepo(job.id, jobVariables);
      await this.createReleaseJobInRepo(releaseId, job.id);
      return job;
    } catch (error) {
      this.log.error(`Failed to create job`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  @Trace()
  private async getJobVariables(
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
    return snapshots.map((s) => ({
      id: crypto.randomUUID(),
      key: s.key,
      value: s.value,
      sensitive: s.sensitive,
    }));
  }

  @Trace()
  async createReleaseJob(release: typeof schema.release.$inferSelect) {
    const versionRelease =
      await this.workspace.repository.versionReleaseRepository.get(
        release.versionReleaseId,
      );
    if (versionRelease == null)
      throw new Error(`Version release ${release.versionReleaseId} not found`);

    const variableRelease =
      await this.workspace.repository.variableReleaseRepository.get(
        release.variableReleaseId,
      );
    if (variableRelease == null)
      throw new Error(
        `Variable release ${release.variableReleaseId} not found`,
      );

    const jobVariables = await this.getJobVariables(variableRelease);

    const { jobAgent, jobAgentConfig } =
      await this.getJobAgentWithConfig(versionRelease);
    const job = await this.createJob(
      release.id,
      jobAgent.id,
      jobAgentConfig,
      jobVariables,
    );

    return job;
  }

  @Trace()
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
      const githubDispatcher = new GithubDispatcher(this.workspace);
      githubDispatcher.dispatchJob(job).catch(async (error) => {
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
      });
    }
  }
}
