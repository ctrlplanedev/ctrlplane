import type {
  Deployment,
  Environment,
  PolicyTarget,
  Resource,
} from "@ctrlplane/db/schema";

export enum MatchChangeType {
  Added = "added",
  Removed = "removed",
}

export type MatchChange<E, S> = {
  entity: E;
  selector: S;
  changeType: MatchChangeType;
};

export interface Selector<S, E> {
  upsertEntity(entity: E): Promise<MatchChange<E, S>[]>;
  removeEntity(entity: E): Promise<MatchChange<E, S>[]>;

  upsertSelector(selector: S): Promise<MatchChange<E, S>[]>;
  removeSelector(selector: S): Promise<MatchChange<E, S>[]>;

  getEntitiesForSelector(selector: S): Promise<E[]>;
  getSelectorsForEntity(entity: E): Promise<S[]>;

  getAllEntities(): Promise<E[]>;
  getAllSelectors(): Promise<S[]>;

  isMatch(entity: E, selector: S): Promise<boolean>;
}

type SelectorManagerOptions = {
  environmentResourceSelector: Selector<Environment, Resource>;
  deploymentResourceSelector: Selector<Deployment, Resource>;
  policyTargetResourceSelector: Selector<PolicyTarget, Resource>;
  policyTargetEnvironmentSelector: Selector<PolicyTarget, Environment>;
  policyTargetDeploymentSelector: Selector<PolicyTarget, Deployment>;
};

export class SelectorManager {
  environmentResources: Selector<Environment, Resource>;
  deploymentResources: Selector<Deployment, Resource>;
  policyTargetResources: Selector<PolicyTarget, Resource>;
  policyTargetEnvironments: Selector<PolicyTarget, Environment>;
  policyTargetDeployments: Selector<PolicyTarget, Deployment>;

  constructor(private opts: SelectorManagerOptions) {
    this.environmentResources = opts.environmentResourceSelector;
    this.deploymentResources = opts.deploymentResourceSelector;
    this.policyTargetResources = opts.policyTargetResourceSelector;
    this.policyTargetEnvironments = opts.policyTargetEnvironmentSelector;
    this.policyTargetDeployments = opts.policyTargetDeploymentSelector;
  }

  async updateResource(resource: Resource) {
    await Promise.all([
      this.environmentResources.upsertEntity(resource),
      this.deploymentResources.upsertEntity(resource),
      this.policyTargetResources.upsertEntity(resource),
    ]);
  }

  async updateEnvironment(environment: Environment) {
    await this.policyTargetEnvironments.upsertEntity(environment);
    await this.environmentResources.upsertSelector(environment);
  }

  async updateDeployment(deployment: Deployment) {
    await this.policyTargetDeployments.upsertEntity(deployment);
    await this.deploymentResources.upsertSelector(deployment);
  }

  async removeResource(resource: Resource) {
    await this.environmentResources.removeEntity(resource);
    await this.deploymentResources.removeEntity(resource);
    await this.policyTargetResources.removeEntity(resource);
  }

  async removeEnvironment(environment: Environment) {
    await this.policyTargetEnvironments.removeEntity(environment);
    await this.environmentResources.removeSelector(environment);
  }

  async removeDeployment(deployment: Deployment) {
    await this.policyTargetDeployments.removeEntity(deployment);
    await this.deploymentResources.removeSelector(deployment);
  }

  async upsertPolicyTargets(policyTarget: PolicyTarget) {
    await this.policyTargetResources.upsertSelector(policyTarget);
    await this.policyTargetEnvironments.upsertSelector(policyTarget);
    await this.policyTargetDeployments.upsertSelector(policyTarget);
  }

  async removePolicyTargets(policyTarget: PolicyTarget) {
    await this.policyTargetResources.removeSelector(policyTarget);
    await this.policyTargetEnvironments.removeSelector(policyTarget);
    await this.policyTargetDeployments.removeSelector(policyTarget);
  }
}
