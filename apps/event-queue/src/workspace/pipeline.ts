import type * as schema from "@ctrlplane/db/schema";

import type { Workspace } from "./workspace.js";

type WorkspaceOptions = {
  workspace: Workspace;

  operation: "update" | "delete";

  resources?: schema.Resource[];
  environments?: schema.Environment[];
  deployments?: schema.Deployment[];
  deploymentVersions?: schema.DeploymentVersion[];
  policies?: schema.Policy[];
  jobs?: schema.Job[];
  jobAgents?: schema.JobAgent[];

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

  resources(...resources: schema.Resource[]) {
    this.opts.resources = resources;
    return this;
  }

  environments(...environments: schema.Environment[]) {
    this.opts.environments = environments;
    return this;
  }

  deployments(...deployments: schema.Deployment[]) {
    this.opts.deployments = deployments;
    return this;
  }

  getReleaseTargetChanges() {}

  async dispatch() {
    const {
      operation,
      workspace,
      resources = [],
      environments = [],
      deployments = [],
    } = this.opts;

    const manager = workspace.selectorManager;

    switch (operation) {
      case "update":
        await Promise.all([
          manager.updateResources(resources),
          manager.updateEnvironments(environments),
          manager.updateDeployments(deployments),
        ]);
        break;
      case "delete":
        await Promise.all([
          manager.removeResources(resources),
          manager.removeEnvironments(environments),
          manager.removeDeployments(deployments),
        ]);
        break;
    }
  }
}
