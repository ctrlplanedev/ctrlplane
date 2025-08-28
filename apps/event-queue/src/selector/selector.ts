import type {
  Deployment,
  Environment,
  PolicyTarget,
  ReleaseTarget,
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
  policyTargetReleaseTargetSelector: Selector<PolicyTarget, ReleaseTarget>;
  // policyTargetResourceSelector: Selector<PolicyTarget, Resource>;
  // policyTargetEnvironmentSelector: Selector<PolicyTarget, Environment>;
  // policyTargetDeploymentSelector: Selector<PolicyTarget, Deployment>;
};

export class SelectorManager {
  environmentResources: Selector<Environment, Resource>;
  deploymentResources: Selector<Deployment, Resource>;
  policyTargetReleaseTargets: Selector<PolicyTarget, ReleaseTarget>;

  constructor(private opts: SelectorManagerOptions) {
    this.environmentResources = opts.environmentResourceSelector;
    this.deploymentResources = opts.deploymentResourceSelector;
    this.policyTargetReleaseTargets = opts.policyTargetReleaseTargetSelector;
  }

  async updateResource(resource: Resource) {
    await Promise.all([
      this.environmentResources.upsertEntity(resource),
      this.deploymentResources.upsertEntity(resource),
    ]);
  }

  async updateEnvironment(environment: Environment) {
    await this.environmentResources.upsertSelector(environment);
  }

  async updateDeployment(deployment: Deployment) {
    await this.deploymentResources.upsertSelector(deployment);
  }

  async removeResource(resource: Resource) {
    await Promise.all([
      this.environmentResources.removeEntity(resource),
      this.deploymentResources.removeEntity(resource),
    ]);
  }

  async removeEnvironment(environment: Environment) {
    await this.environmentResources.removeSelector(environment);
  }

  async removeDeployment(deployment: Deployment) {
    await this.deploymentResources.removeSelector(deployment);
  }

  async upsertReleaseTarget(releaseTarget: ReleaseTarget) {
    await this.policyTargetReleaseTargets.upsertEntity(releaseTarget);
  }

  async removeReleaseTarget(releaseTarget: ReleaseTarget) {
    await this.policyTargetReleaseTargets.removeEntity(releaseTarget);
  }

  async upsertPolicyTargets(policyTarget: PolicyTarget) {
    await this.policyTargetReleaseTargets.upsertSelector(policyTarget);
  }

  async removePolicyTargets(policyTarget: PolicyTarget) {
    await this.policyTargetReleaseTargets.removeSelector(policyTarget);
  }
}
