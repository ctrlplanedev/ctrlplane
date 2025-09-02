import type * as schema from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import type { Workspace } from "./workspace.js";
import { dispatchJob } from "../job-dispatch/index.js";

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
  private constructor(private opts: WorkspaceOptions) {}

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
    const { releaseTargetManager } = workspace;

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

    const { addedReleaseTargets } =
      await workspace.releaseTargetManager.computeReleaseTargetChanges();

    const jobsToDispatch = await Promise.all(
      addedReleaseTargets.map((rt) => releaseTargetManager.evaluate(rt)),
    ).then((jobs) => jobs.filter(isPresent));

    await Promise.all(
      jobsToDispatch.map((job) => dispatchJob(job, workspace.id)),
    );
  }
}
