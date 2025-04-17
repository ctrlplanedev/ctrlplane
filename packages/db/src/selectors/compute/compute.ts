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

  allEnvironments(workspaceId: string) {
    return new WorkspaceEnvironmentBuilder(this.tx, workspaceId);
  }

  environments(ids: string[]) {
    return new EnvironmentBuilder(this.tx, ids);
  }

  allDeployments(workspaceId: string) {
    return new WorkspaceDeploymentBuilder(this.tx, workspaceId);
  }

  deployments(ids: string[]) {
    return new DeploymentBuilder(this.tx, ids);
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
