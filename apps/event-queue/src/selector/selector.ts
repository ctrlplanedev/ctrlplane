import type {
  Deployment,
  DeploymentVersion,
  Environment,
  PolicyDeploymentVersionSelector,
  PolicyTarget,
  ReleaseTarget,
  Resource,
} from "@ctrlplane/db/schema";

export interface Selector<S, E> {
  upsertEntity(entity: E): Promise<void>;
  removeEntity(entity: E): Promise<void>;

  upsertSelector(selector: S): Promise<void>;
  removeSelector(selector: S): Promise<void>;

  getEntitiesForSelector(selector: S): Promise<E[]>;
  getSelectorsForEntity(entity: E): Promise<S[]>;

  getAllEntities(): Promise<E[]>;
  getAllSelectors(): Promise<S[]>;

  isMatch(entity: E, selector: S): Promise<boolean>;
}

type SelectorManagerOptions = {
  environmentResourceSelector: Selector<Environment, Resource>;
  deploymentResourceSelector: Selector<Deployment, Resource>;
  policyTargetReleaseTargetSelector: Selector<PolicyTarget, ReleaseTarget>;
  deploymentVersionSelector: Selector<
    PolicyDeploymentVersionSelector,
    DeploymentVersion
  >;
};

export class SelectorManager {
  constructor(private opts: SelectorManagerOptions) {}

  get policyTargetReleaseTargetSelector() {
    return this.opts.policyTargetReleaseTargetSelector;
  }

  get deploymentVersionSelector() {
    return this.opts.deploymentVersionSelector;
  }

  get environmentResourceSelector() {
    return this.opts.environmentResourceSelector;
  }

  get deploymentResourceSelector() {
    return this.opts.deploymentResourceSelector;
  }

  async updateResource(resource: Resource) {
    const [environmentChanges, deploymentChanges] = await Promise.all([
      this.opts.environmentResourceSelector.upsertEntity(resource),
      this.opts.deploymentResourceSelector.upsertEntity(resource),
    ]);

    return { environmentChanges, deploymentChanges };
  }

  async updateEnvironment(environment: Environment) {
    return this.opts.environmentResourceSelector.upsertSelector(environment);
  }

  async updateDeployment(deployment: Deployment) {
    return this.opts.deploymentResourceSelector.upsertSelector(deployment);
  }

  async removeResource(resource: Resource) {
    const [environmentChanges, deploymentChanges] = await Promise.all([
      this.opts.environmentResourceSelector.removeEntity(resource),
      this.opts.deploymentResourceSelector.removeEntity(resource),
    ]);

    return { environmentChanges, deploymentChanges };
  }

  async removeEnvironment(environment: Environment) {
    return this.opts.environmentResourceSelector.removeSelector(environment);
  }

  async removeDeployment(deployment: Deployment) {
    return this.opts.deploymentResourceSelector.removeSelector(deployment);
  }

  async upsertReleaseTarget(releaseTarget: ReleaseTarget) {
    return this.opts.policyTargetReleaseTargetSelector.upsertEntity(
      releaseTarget,
    );
  }

  async removeReleaseTarget(releaseTarget: ReleaseTarget) {
    return this.opts.policyTargetReleaseTargetSelector.removeEntity(
      releaseTarget,
    );
  }

  async upsertPolicyTargets(policyTarget: PolicyTarget) {
    return this.opts.policyTargetReleaseTargetSelector.upsertSelector(
      policyTarget,
    );
  }

  async removePolicyTargets(policyTarget: PolicyTarget) {
    return this.opts.policyTargetReleaseTargetSelector.removeSelector(
      policyTarget,
    );
  }
}
