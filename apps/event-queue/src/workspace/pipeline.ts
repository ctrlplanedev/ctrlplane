import type * as schema from "@ctrlplane/db/schema";
import type { FullPolicy, FullResource } from "@ctrlplane/events";
import { isPresent } from "ts-is-present";

import type { Workspace } from "./workspace.js";

type WorkspaceOptions = {
  workspace: Workspace;

  operation: "update" | "delete" | "evaluate";

  resource?: FullResource;
  resourceVariable?: typeof schema.resourceVariable.$inferSelect;
  environment?: schema.Environment;
  deployment?: schema.Deployment;
  deploymentVersion?: schema.DeploymentVersion;
  deploymentVariable?: schema.DeploymentVariable;
  deploymentVariableValue?: schema.DeploymentVariableValue;
  policy?: FullPolicy;
  job?: schema.Job;
  jobAgent?: schema.JobAgent;

  releaseTargets?: {
    toEvaluate: schema.ReleaseTarget[];
    removed: schema.ReleaseTarget[];
    skipDuplicateCheck?: boolean;
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

  static evaluate(workspace: Workspace) {
    return new OperationPipeline({ workspace, operation: "evaluate" });
  }

  resource(resource: FullResource) {
    this.opts.resource = resource;
    return this;
  }

  resourceVariable(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ) {
    this.opts.resourceVariable = resourceVariable;
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

  deploymentVariable(deploymentVariable: schema.DeploymentVariable) {
    this.opts.deploymentVariable = deploymentVariable;
    return this;
  }

  deploymentVariableValue(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ) {
    this.opts.deploymentVariableValue = deploymentVariableValue;
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

  releaseTargets(
    releaseTargets: schema.ReleaseTarget[],
    opts?: { skipDuplicateCheck?: boolean },
  ) {
    if (this.opts.releaseTargets == null)
      this.opts.releaseTargets = {
        toEvaluate: [],
        removed: [],
        skipDuplicateCheck: opts?.skipDuplicateCheck ?? false,
      };
    this.opts.releaseTargets.toEvaluate.push(...releaseTargets);
    return this;
  }

  private async markDeploymentReleaseTargetsAsStale(deploymentId: string) {
    const allReleaseTargets =
      await this.opts.workspace.repository.releaseTargetRepository.getAll();
    const releaseTargets = allReleaseTargets.filter(
      (rt) => rt.deploymentId === deploymentId,
    );
    this.opts.releaseTargets = {
      toEvaluate: releaseTargets,
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

  private async upsertJob(job: schema.Job) {
    const previous = await this.opts.workspace.repository.jobRepository.get(
      job.id,
    );
    if (previous == null) throw new Error("Job not found");
    await this.opts.workspace.jobManager.updateJob(previous, job);
  }

  private async upsertDeploymentVersion(
    deploymentVersion: schema.DeploymentVersion,
  ) {
    await this.opts.workspace.selectorManager.deploymentVersionSelector.upsertEntity(
      deploymentVersion,
    );
    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVersion.deploymentId,
    );
  }

  private async removeDeploymentVersion(
    deploymentVersion: schema.DeploymentVersion,
  ) {
    await this.opts.workspace.selectorManager.deploymentVersionSelector.removeEntity(
      deploymentVersion,
    );
    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVersion.deploymentId,
    );
  }

  private async upsertDeploymentVariable(
    deploymentVariable: schema.DeploymentVariable,
  ) {
    const existing =
      await this.opts.workspace.repository.deploymentVariableRepository.get(
        deploymentVariable.id,
      );
    if (existing == null)
      await this.opts.workspace.repository.deploymentVariableRepository.create(
        deploymentVariable,
      );
    if (existing != null)
      await this.opts.workspace.repository.deploymentVariableRepository.update(
        deploymentVariable,
      );

    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVariable.deploymentId,
    );
  }

  private async removeDeploymentVariable(
    deploymentVariable: schema.DeploymentVariable,
  ) {
    const allDeploymentVariableValues =
      await this.opts.workspace.repository.deploymentVariableValueRepository.getAll();
    const deploymentVariableValues = allDeploymentVariableValues.filter(
      (dv) => dv.variableId === deploymentVariable.id,
    );
    await Promise.all(
      deploymentVariableValues.map((dv) =>
        this.opts.workspace.repository.deploymentVariableValueRepository.delete(
          dv.id,
        ),
      ),
    );

    await this.opts.workspace.repository.deploymentVariableRepository.delete(
      deploymentVariable.id,
    );
    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVariable.deploymentId,
    );
  }

  private async upsertDeploymentVariableValue(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ) {
    const existing =
      await this.opts.workspace.repository.deploymentVariableValueRepository.get(
        deploymentVariableValue.id,
      );
    if (existing == null)
      await this.opts.workspace.repository.deploymentVariableValueRepository.create(
        deploymentVariableValue,
      );
    if (existing != null)
      await this.opts.workspace.repository.deploymentVariableValueRepository.update(
        deploymentVariableValue,
      );

    const upsertedValue =
      await this.opts.workspace.repository.deploymentVariableValueRepository.get(
        deploymentVariableValue.id,
      );
    if (upsertedValue == null)
      throw new Error("Deployment variable value not found");

    const deploymentVariable =
      await this.opts.workspace.repository.deploymentVariableRepository.get(
        deploymentVariableValue.variableId,
      );
    if (deploymentVariable == null)
      throw new Error("Deployment variable not found");

    if (deploymentVariableValue.isDefault)
      await this.opts.workspace.repository.deploymentVariableRepository.update({
        ...deploymentVariable,
        defaultValueId: upsertedValue.id,
      });

    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVariable.deploymentId,
    );
  }

  private async removeDeploymentVariableValue(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ) {
    await this.opts.workspace.repository.deploymentVariableValueRepository.delete(
      deploymentVariableValue.id,
    );

    const deploymentVariable =
      await this.opts.workspace.repository.deploymentVariableRepository.get(
        deploymentVariableValue.variableId,
      );
    if (deploymentVariable == null)
      throw new Error("Deployment variable not found");

    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVariable.deploymentId,
    );
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

  private async markResourceReleaseTargetsAsStale(resourceId: string) {
    const allReleaseTargets =
      await this.opts.workspace.repository.releaseTargetRepository.getAll();
    const releaseTargets = allReleaseTargets.filter(
      (rt) => rt.resourceId === resourceId,
    );
    this.opts.releaseTargets = {
      toEvaluate: releaseTargets,
      removed: [],
    };
  }

  private async upsertEnvironment(environment: schema.Environment) {
    const existing =
      await this.opts.workspace.repository.environmentRepository.get(
        environment.id,
      );
    if (existing == null)
      await this.opts.workspace.repository.environmentRepository.create(
        environment,
      );
    if (existing != null)
      await this.opts.workspace.repository.environmentRepository.update(
        environment,
      );

    await this.opts.workspace.selectorManager.updateEnvironment(environment);
  }

  private async removeEnvironment(environment: schema.Environment) {
    await this.opts.workspace.repository.environmentRepository.delete(
      environment.id,
    );
    await this.opts.workspace.selectorManager.removeEnvironment(environment);
  }

  private async upsertDeployment(deployment: schema.Deployment) {
    const existing =
      await this.opts.workspace.repository.deploymentRepository.get(
        deployment.id,
      );
    if (existing == null)
      await this.opts.workspace.repository.deploymentRepository.create(
        deployment,
      );
    if (existing != null)
      await this.opts.workspace.repository.deploymentRepository.update(
        deployment,
      );

    await this.opts.workspace.selectorManager.updateDeployment(deployment);
  }

  private async removeDeployment(deployment: schema.Deployment) {
    await this.opts.workspace.repository.deploymentRepository.delete(
      deployment.id,
    );
    await this.opts.workspace.selectorManager.removeDeployment(deployment);
  }

  private async upsertResource(resource: FullResource) {
    const existing =
      await this.opts.workspace.repository.resourceRepository.get(resource.id);
    if (existing == null)
      await this.opts.workspace.repository.resourceRepository.create(resource);
    if (existing != null)
      await this.opts.workspace.repository.resourceRepository.update(resource);

    await this.opts.workspace.selectorManager.updateResource(resource);
    // await this.opts.workspace.resourceRelationshipManager.upsertResource(
    //   resource,
    // );
    // const children = await this.opts.workspace.resourceRelationshipManager
    //   .getResourceChildren(resource)
    //   .then((children) => children.map((c) => c.target));
    // const allReleaseTargets =
    //   await this.opts.workspace.repository.releaseTargetRepository.getAll();
    // const releaseTargets = allReleaseTargets.filter((rt) =>
    //   children.some((c) => c.id === rt.resourceId),
    // );
    // this.opts.releaseTargets = {
    //   toEvaluate: [
    //     ...(this.opts.releaseTargets?.toEvaluate ?? []),
    //     ...releaseTargets,
    //   ],
    //   removed: this.opts.releaseTargets?.removed ?? [],
    // };
  }

  private async removeResource(resource: FullResource) {
    await this.opts.workspace.repository.resourceRepository.delete(resource.id);
    await this.opts.workspace.selectorManager.removeResource(resource);
    // await this.opts.workspace.resourceRelationshipManager.deleteResource(
    //   resource,
    // );
    // const children = await this.opts.workspace.resourceRelationshipManager
    //   .getResourceChildren(resource)
    //   .then((children) => children.map((c) => c.target));
    // const allReleaseTargets =
    //   await this.opts.workspace.repository.releaseTargetRepository.getAll();
    // const releaseTargets = allReleaseTargets.filter((rt) =>
    //   children.some((c) => c.id === rt.resourceId),
    // );
    // this.opts.releaseTargets = {
    //   toEvaluate: [
    //     ...(this.opts.releaseTargets?.toEvaluate ?? []),
    //     ...releaseTargets,
    //   ],
    //   removed: this.opts.releaseTargets?.removed ?? [],
    // };
  }

  private async upsertResourceVariable(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ) {
    const existing =
      await this.opts.workspace.repository.resourceVariableRepository.get(
        resourceVariable.id,
      );
    if (existing == null)
      await this.opts.workspace.repository.resourceVariableRepository.create(
        resourceVariable,
      );
    if (existing != null)
      await this.opts.workspace.repository.resourceVariableRepository.update(
        resourceVariable,
      );

    await this.markResourceReleaseTargetsAsStale(resourceVariable.resourceId);
  }

  private async removeResourceVariable(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ) {
    await this.opts.workspace.repository.resourceVariableRepository.delete(
      resourceVariable.id,
    );

    await this.markResourceReleaseTargetsAsStale(resourceVariable.resourceId);
  }

  async getReleaseTargetChanges() {
    const { addedReleaseTargets, removedReleaseTargets } =
      await this.opts.workspace.releaseTargetManager.computeReleaseTargetChanges();

    this.opts.releaseTargets = {
      toEvaluate: [
        ...(this.opts.releaseTargets?.toEvaluate ?? []),
        ...addedReleaseTargets,
      ],
      removed: [
        ...(this.opts.releaseTargets?.removed ?? []),
        ...removedReleaseTargets,
      ],
    };
  }

  async dispatch() {
    const {
      operation,
      workspace,
      resource,
      resourceVariable,
      environment,
      deployment,
      deploymentVersion,
      policy,
      job,
      deploymentVariable,
      deploymentVariableValue,
    } = this.opts;

    const { releaseTargetManager } = workspace;
    const { jobManager } = workspace;

    switch (operation) {
      case "update":
        await Promise.all([
          resource ? this.upsertResource(resource) : Promise.resolve(),
          resourceVariable
            ? this.upsertResourceVariable(resourceVariable)
            : Promise.resolve(),
          environment ? this.upsertEnvironment(environment) : Promise.resolve(),
          deployment ? this.upsertDeployment(deployment) : Promise.resolve(),
          deploymentVersion
            ? this.upsertDeploymentVersion(deploymentVersion)
            : Promise.resolve(),
          policy ? this.updatePolicy(policy) : Promise.resolve(),
          job ? this.upsertJob(job) : Promise.resolve(),
          deploymentVariable
            ? this.upsertDeploymentVariable(deploymentVariable)
            : Promise.resolve(),
          deploymentVariableValue
            ? this.upsertDeploymentVariableValue(deploymentVariableValue)
            : Promise.resolve(),
        ]);

        if (resource != null || environment != null || deployment != null)
          await this.getReleaseTargetChanges();
        break;
      case "delete":
        await Promise.all([
          resource ? this.removeResource(resource) : Promise.resolve(),
          resourceVariable
            ? this.removeResourceVariable(resourceVariable)
            : Promise.resolve(),
          environment ? this.removeEnvironment(environment) : Promise.resolve(),
          deployment ? this.removeDeployment(deployment) : Promise.resolve(),
          deploymentVersion
            ? this.removeDeploymentVersion(deploymentVersion)
            : Promise.resolve(),
          policy ? this.removePolicy(policy) : Promise.resolve(),
          deploymentVariable
            ? this.removeDeploymentVariable(deploymentVariable)
            : Promise.resolve(),
          deploymentVariableValue
            ? this.removeDeploymentVariableValue(deploymentVariableValue)
            : Promise.resolve(),
        ]);

        if (resource != null || environment != null || deployment != null)
          await this.getReleaseTargetChanges();
        break;
    }

    const jobsToDispatch = await Promise.all(
      (this.opts.releaseTargets?.toEvaluate ?? []).map((rt) =>
        releaseTargetManager.evaluate(rt, {
          skipDuplicateCheck: this.opts.releaseTargets?.skipDuplicateCheck,
        }),
      ),
    ).then((jobs) => jobs.filter(isPresent));

    await Promise.all(jobsToDispatch.map((job) => jobManager.dispatchJob(job)));
  }
}
