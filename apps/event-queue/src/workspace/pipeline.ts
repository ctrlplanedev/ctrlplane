import type * as schema from "@ctrlplane/db/schema";
import type { FullPolicy } from "@ctrlplane/events";
import { isPresent } from "ts-is-present";

import type { Workspace } from "./workspace.js";

type WorkspaceOptions = {
  workspace: Workspace;

  operation: "update" | "delete";

  resource?: schema.Resource;
  environment?: schema.Environment;
  deployment?: schema.Deployment;
  deploymentVersion?: schema.DeploymentVersion;
  policy?: FullPolicy;
  job?: schema.Job;
  jobAgent?: schema.JobAgent;

  releaseTargets?: {
    toEvaluate: schema.ReleaseTarget[];
    removed: schema.ReleaseTarget[];
  };
};

export class OperationPipeline {
  private constructor(private opts: WorkspaceOptions) {}

  static update(workspace: Workspace) {
    return new OperationPipeline({ workspace, operation: "update" });
  }

  static delete(workspace: Workspace) {
    return new OperationPipeline({ workspace, operation: "delete" });
  }

  resource(resource: schema.Resource) {
    this.opts.resource = resource;
    return this;
  }

  environment(environment: schema.Environment) {
    this.opts.environment = environment;
    return this;
  }

  deployment(deployment: schema.Deployment) {
    this.opts.deployment = deployment;
    return this;
  }

  deploymentVersion(deploymentVersion: schema.DeploymentVersion) {
    this.opts.deploymentVersion = deploymentVersion;
    return this;
  }

  policy(policy: FullPolicy) {
    this.opts.policy = policy;
    return this;
  }

  job(job: schema.Job) {
    this.opts.job = job;
    return this;
  }

  private async getReleaseTargetsForDeploymentVersion(
    deploymentVersion: schema.DeploymentVersion,
  ) {
    const allReleaseTargets =
      await this.opts.workspace.repository.releaseTargetRepository.getAll();
    const targetsForDeployment = allReleaseTargets.filter(
      (rt) => rt.deploymentId === deploymentVersion.deploymentId,
    );
    this.opts.releaseTargets = {
      toEvaluate: targetsForDeployment,
      removed: [],
    };
  }

  private async getReleaseTargetsForPolicy(policy: schema.Policy) {
    const allPolicyTargets =
      await this.opts.workspace.selectorManager.policyTargetReleaseTargetSelector.getAllSelectors();
    const policyTargets = allPolicyTargets.filter(
      (pt) => pt.policyId === policy.id,
    );
    const releaseTargets = await Promise.all(
      policyTargets.map((pt) =>
        this.opts.workspace.selectorManager.policyTargetReleaseTargetSelector.getEntitiesForSelector(
          pt,
        ),
      ),
    ).then((releaseTargets) => releaseTargets.flat());

    this.opts.releaseTargets = {
      toEvaluate: releaseTargets,
      removed: [],
    };
  }

  private async updatePolicy(policy: FullPolicy) {
    const { targets } = policy;
    await Promise.all(
      targets.map((target) =>
        this.opts.workspace.selectorManager.policyTargetReleaseTargetSelector.upsertSelector(
          target,
        ),
      ),
    );

    await this.opts.workspace.repository.versionRuleRepository.upsertPolicyRules(
      policy,
    );

    await this.opts.workspace.repository.policyRepository.update(policy);
    await this.getReleaseTargetsForPolicy(policy);
  }

  private async removePolicy(policy: schema.Policy) {
    await this.getReleaseTargetsForPolicy(policy);
    const allPolicyTargets =
      await this.opts.workspace.selectorManager.policyTargetReleaseTargetSelector.getAllSelectors();
    const policyTargets = allPolicyTargets.filter(
      (pt) => pt.policyId === policy.id,
    );
    await Promise.all(
      policyTargets.map((pt) =>
        this.opts.workspace.selectorManager.policyTargetReleaseTargetSelector.removeSelector(
          pt,
        ),
      ),
    );
    await this.opts.workspace.repository.versionRuleRepository.removePolicyRules(
      policy.id,
    );
    await this.opts.workspace.repository.policyRepository.delete(policy.id);
  }

  async getReleaseTargetChanges() {
    const { addedReleaseTargets, removedReleaseTargets } =
      await this.opts.workspace.releaseTargetManager.computeReleaseTargetChanges();

    this.opts.releaseTargets = {
      toEvaluate: addedReleaseTargets,
      removed: removedReleaseTargets,
    };
  }

  async dispatch() {
    const { operation, workspace, resource, environment, deployment } =
      this.opts;

    const manager = workspace.selectorManager;
    const { releaseTargetManager } = workspace;
    const { jobManager } = workspace;

    switch (operation) {
      case "update":
        if (this.opts.deploymentVersion != null) {
          await workspace.selectorManager.deploymentVersionSelector.upsertEntity(
            this.opts.deploymentVersion,
          );
          await this.getReleaseTargetsForDeploymentVersion(
            this.opts.deploymentVersion,
          );
        }

        if (this.opts.policy != null) await this.updatePolicy(this.opts.policy);

        if (this.opts.job != null) {
          const previous = await workspace.repository.jobRepository.get(
            this.opts.job.id,
          );
          if (previous == null) throw new Error("Job not found");
          await jobManager.updateJob(previous, this.opts.job);
        }

        await Promise.all([
          resource ? manager.updateResource(resource) : Promise.resolve(),
          environment
            ? manager.updateEnvironment(environment)
            : Promise.resolve(),
          deployment ? manager.updateDeployment(deployment) : Promise.resolve(),
        ]);

        if (resource != null || environment != null || deployment != null)
          await this.getReleaseTargetChanges();
        break;
      case "delete":
        if (this.opts.deploymentVersion != null) {
          await workspace.selectorManager.deploymentVersionSelector.removeEntity(
            this.opts.deploymentVersion,
          );
          await this.getReleaseTargetsForDeploymentVersion(
            this.opts.deploymentVersion,
          );
        }

        if (this.opts.policy != null) await this.removePolicy(this.opts.policy);

        await Promise.all([
          resource ? manager.removeResource(resource) : Promise.resolve(),
          environment
            ? manager.removeEnvironment(environment)
            : Promise.resolve(),
          deployment ? manager.removeDeployment(deployment) : Promise.resolve(),
        ]);

        if (resource != null || environment != null || deployment != null)
          await this.getReleaseTargetChanges();
        break;
    }

    const jobsToDispatch = await Promise.all(
      (this.opts.releaseTargets?.toEvaluate ?? []).map((rt) =>
        releaseTargetManager.evaluate(rt),
      ),
    ).then((jobs) => jobs.filter(isPresent));

    await Promise.all(jobsToDispatch.map((job) => jobManager.dispatchJob(job)));
  }
}
