import type {
  Deployment,
  Environment,
  PolicyTarget,
  Resource,
  Workspace,
} from "@ctrlplane/db/schema";

export interface Selector<S, E> {
  upsertEntity(...entity: E[]): Promise<void>;
  removeEntity(...entity: E[]): Promise<void>;

  upsertSelector(...selector: S[]): Promise<void>;
  removeSelector(...selector: S[]): Promise<void>;

  getEntitiesForSelector(selector: S): Promise<E[]>;
  getSelectorsForEntity(entity: E): Promise<S[]>;

  getAllEntities(): Promise<E[]>;
  getAllSelectors(): Promise<S[]>;

  isMatch(entity: E, selector: S): Promise<boolean>;
}

type SelectorManagerOptions = {};

export class SelectorManager {
  environmentResources: Selector<Environment, Resource>;
  deploymentResources: Selector<Deployment, Resource>;
  policyTargetResources: Selector<PolicyTarget, Resource>;
  policyTargetEnvironments: Selector<PolicyTarget, Environment>;
  policyTargetDeployments: Selector<PolicyTarget, Deployment>;

  constructor(private opts: SelectorManagerOptions) {}

  async updateResources(resources: Resource[]) {
    await Promise.all([
      this.environmentResources.upsertEntity(...resources),
      this.deploymentResources.upsertEntity(...resources),
      this.policyTargetResources.upsertEntity(...resources),
    ]);
  }

  async updateEnvironments(environments: Environment[]) {
    await this.policyTargetEnvironments.upsertEntity(...environments);
    await this.environmentResources.upsertSelector(...environments);
  }

  async updateDeployments(deployments: Deployment[]) {
    await this.policyTargetDeployments.upsertEntity(...deployments);
    await this.deploymentResources.upsertSelector(...deployments);
  }

  async removeResources(resources: Resource[]) {
    await this.environmentResources.removeEntity(...resources);
    await this.deploymentResources.removeEntity(...resources);
    await this.policyTargetResources.removeEntity(...resources);
  }

  async removeEnvironments(environments: Environment[]) {
    await this.policyTargetEnvironments.removeEntity(...environments);
    await this.environmentResources.removeSelector(...environments);
  }

  async removeDeployments(deployments: Deployment[]) {
    await this.policyTargetDeployments.removeEntity(...deployments);
    await this.deploymentResources.removeSelector(...deployments);
  }

  async upsertPolicyTargets(policyTargets: PolicyTarget[]) {
    await this.policyTargetResources.upsertSelector(...policyTargets);
    await this.policyTargetEnvironments.upsertSelector(...policyTargets);
    await this.policyTargetDeployments.upsertSelector(...policyTargets);
  }

  async removePolicyTargets(policyTargets: PolicyTarget[]) {
    await this.policyTargetResources.removeSelector(...policyTargets);
    await this.policyTargetEnvironments.removeSelector(...policyTargets);
    await this.policyTargetDeployments.removeSelector(...policyTargets);
  }
}
