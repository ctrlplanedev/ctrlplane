import type { Tx } from "../../common.js";
import {
  DeploymentBuilder,
  WorkspaceDeploymentBuilder,
} from "./deployment-builder.js";
import {
  EnvironmentBuilder,
  WorkspaceEnvironmentBuilder,
} from "./environment-builder.js";

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
}
