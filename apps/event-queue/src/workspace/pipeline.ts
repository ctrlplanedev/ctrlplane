import type * as schema from "@ctrlplane/db/schema";
import type {
  FullPolicy,
  FullReleaseTarget,
  FullResource,
} from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";

import type { Workspace } from "./workspace.js";
import { Trace } from "../traces.js";

const log = logger.child({ module: "operation-pipeline" });

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
    toEvaluate: FullReleaseTarget[];
    removed: FullReleaseTarget[];
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
    releaseTargets: FullReleaseTarget[],
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

  @Trace()
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

  @Trace()
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

  @Trace()
  private async upsertJob(job: schema.Job) {
    const previous = await this.opts.workspace.repository.jobRepository.get(
      job.id,
    );
    if (previous == null) throw new Error("Job not found");
    await this.opts.workspace.jobManager.updateJob(previous, job);
  }

  @Trace()
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

  @Trace()
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

  @Trace()
  private async upsertDeploymentVariable(
    deploymentVariable: schema.DeploymentVariable,
  ) {
    log.info("Upserting deployment variable");
    const upsertStart = performance.now();

    log.info("Checking existing deployment variable");
    const checkExistingStart = performance.now();
    const existing =
      await this.opts.workspace.repository.deploymentVariableRepository.get(
        deploymentVariable.id,
      );
    const checkExistingEnd = performance.now();
    const checkExistingDuration = checkExistingEnd - checkExistingStart;
    log.info(
      `Checking existing deployment variable took ${checkExistingDuration.toFixed(2)}ms`,
    );

    log.info("Repository upserting deployment variable");
    const repoUpsertStart = performance.now();
    if (existing == null)
      await this.opts.workspace.repository.deploymentVariableRepository.create(
        deploymentVariable,
      );
    if (existing != null)
      await this.opts.workspace.repository.deploymentVariableRepository.update(
        deploymentVariable,
      );
    const repoUpsertEnd = performance.now();
    const repoUpsertDuration = repoUpsertEnd - repoUpsertStart;
    log.info(
      `Repository upserting deployment variable took ${repoUpsertDuration.toFixed(2)}ms`,
    );

    log.info("Marking deployment release targets as stale");
    const markStart = performance.now();
    await this.markDeploymentReleaseTargetsAsStale(
      deploymentVariable.deploymentId,
    );
    const markEnd = performance.now();
    const markDuration = markEnd - markStart;
    log.info(
      `Marking deployment release targets as stale took ${markDuration.toFixed(2)}ms`,
    );

    const upsertEnd = performance.now();
    const upsertDuration = upsertEnd - upsertStart;
    log.info(
      `Upserting deployment variable took ${upsertDuration.toFixed(2)}ms`,
    );
  }

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
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

  @Trace()
  private async removeEnvironment(environment: schema.Environment) {
    await this.opts.workspace.repository.environmentRepository.delete(
      environment.id,
    );
    await this.opts.workspace.selectorManager.removeEnvironment(environment);
  }

  @Trace()
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

  @Trace()
  private async removeDeployment(deployment: schema.Deployment) {
    await this.opts.workspace.repository.deploymentRepository.delete(
      deployment.id,
    );
    await this.opts.workspace.selectorManager.removeDeployment(deployment);
  }

  @Trace()
  private async upsertResource(resource: FullResource) {
    try {
      const existing =
        await this.opts.workspace.repository.resourceRepository.get(
          resource.id,
        );
      if (existing == null)
        await this.opts.workspace.repository.resourceRepository.create(
          resource,
        );
      if (existing != null)
        await this.opts.workspace.repository.resourceRepository.update(
          resource,
        );

      await this.opts.workspace.selectorManager.updateResource(resource);
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      logger.error("Error upserting resource", { error: e });
      throw e;
    }
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

  @Trace()
  private async removeResource(resource: FullResource) {
    try {
      await this.opts.workspace.repository.resourceRepository.delete(
        resource.id,
      );
      await this.opts.workspace.selectorManager.removeResource(resource);
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      logger.error("Error removing resource", { error: e });
      throw e;
    }
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

  @Trace()
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

  @Trace()
  private async removeResourceVariable(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ) {
    await this.opts.workspace.repository.resourceVariableRepository.delete(
      resourceVariable.id,
    );

    await this.markResourceReleaseTargetsAsStale(resourceVariable.resourceId);
  }

  @Trace()
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

  @Trace()
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

    log.info(
      `Evaluating ${this.opts.releaseTargets?.toEvaluate.length ?? 0} release targets`,
    );
    const evaluateStart = performance.now();

    const jobsToDispatch: schema.Job[] = [];

    const releaseTargetsToEvaluate = this.opts.releaseTargets?.toEvaluate ?? [];
    const batches = _.chunk(releaseTargetsToEvaluate, 10);

    for (const batch of batches) {
      const batchStart = performance.now();
      const jobs = await Promise.allSettled(
        batch.map((rt) =>
          releaseTargetManager.evaluate(rt, {
            skipDuplicateCheck: this.opts.releaseTargets?.skipDuplicateCheck,
          }),
        ),
      ).then((results) =>
        results
          .map((r) => (r.status === "fulfilled" ? r.value : null))
          .filter(isPresent),
      );
      jobsToDispatch.push(...jobs);
      const batchEnd = performance.now();
      const batchDuration = batchEnd - batchStart;
      log.info(
        `Evaluating batch of ${batch.length} release targets took ${batchDuration.toFixed(2)}ms`,
      );
    }

    const evaluateEnd = performance.now();
    const evaluateDuration = evaluateEnd - evaluateStart;
    log.info(
      `Release target evaluation took ${evaluateDuration.toFixed(2)}ms, found ${jobsToDispatch.length} jobs to dispatch`,
    );

    await Promise.all(jobsToDispatch.map((job) => jobManager.dispatchJob(job)));
  }
}
