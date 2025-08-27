import type * as schema from "@ctrlplane/db/schema";

import type { Workspace } from "./workspace.js";

type WorkspaceOptions = {
  workspace: Workspace;

  operation: "update" | "delete";

  resource?: schema.Resource;
  environment?: schema.Environment;
  deployment?: schema.Deployment;
  deploymentVersion?: schema.DeploymentVersion;
  policy?: schema.Policy;
  job?: schema.Job;
  jobAgent?: schema.JobAgent;

  releaseTargets?: {
    new: schema.ReleaseTarget[];
    removed: schema.ReleaseTarget[];
  };
};

export class OperationPipeline {
  private promise: Promise<OperationPipeline>;

  private constructor(private opts: WorkspaceOptions) {
    this.promise = Promise.resolve(this);
  }

  static update(workspace: Workspace) {
    return new OperationPipeline({ workspace, operation: "update" });
  }

  static delete(workspace: Workspace) {
    return new OperationPipeline({ workspace, operation: "delete" });
  }

  resource(resource: schema.Resource) {
    this.opts.resource = resource;
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

  getReleaseTargetChanges() {}

  async dispatch() {
    const { operation, workspace, resource, environment, deployment } =
      this.opts;

    const manager = workspace.selectorManager;

    switch (operation) {
      case "update":
        await Promise.all([
          resource ? manager.updateResource(resource) : Promise.resolve(),
          environment
            ? manager.updateEnvironment(environment)
            : Promise.resolve(),
          deployment ? manager.updateDeployment(deployment) : Promise.resolve(),
        ]);
        break;
      case "delete":
        await Promise.all([
          resource ? manager.removeResource(resource) : Promise.resolve(),
          environment
            ? manager.removeEnvironment(environment)
            : Promise.resolve(),
          deployment ? manager.removeDeployment(deployment) : Promise.resolve(),
        ]);
        break;
    }
  }
}
