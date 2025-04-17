import type { Tx } from "../../common.js";
import type * as schema from "../../schema/index.js";
import {
  DeploymentBuilder,
  WorkspaceDeploymentBuilder,
} from "./deployment-builder.js";
import {
  EnvironmentBuilder,
  WorkspaceEnvironmentBuilder,
} from "./environment-builder.js";
import { PolicyBuilder, WorkspacePolicyBuilder } from "./policy-builder.js";
import { ResourceBuilder } from "./resource-builder.js";

export class ComputeBuilder {
  constructor(private readonly tx: Tx) {}

  allResourceSelectors(workspaceId: string) {
    return Promise.all([
      this.allEnvironments(workspaceId).resourceSelectors(),
      this.allDeployments(workspaceId).resourceSelectors(),
    ]);
  }

  allEnvironments(workspaceId: string) {
    return new WorkspaceEnvironmentBuilder(this.tx, workspaceId);
  }

  environments(environments: schema.Environment[]) {
    return new EnvironmentBuilder(this.tx, environments);
  }

  allDeployments(workspaceId: string) {
    return new WorkspaceDeploymentBuilder(this.tx, workspaceId);
  }

  deployments(deployments: schema.Deployment[]) {
    return new DeploymentBuilder(this.tx, deployments);
  }

  allPolicies(workspaceId: string) {
    return new WorkspacePolicyBuilder(this.tx, workspaceId);
  }

  policies(ids: string[]) {
    return new PolicyBuilder(this.tx, ids);
  }

  resources(resources: schema.Resource[]) {
    return new ResourceBuilder(this.tx, resources);
  }
}
