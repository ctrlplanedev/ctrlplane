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
};

export class SelectorManager {
  constructor(private opts: SelectorManagerOptions) {}

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
