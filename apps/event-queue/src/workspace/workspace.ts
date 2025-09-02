import { DbDeploymentResourceSelector } from "../selector/db-deployment-resource.js";
import { DbDeploymentVersionSelector } from "../selector/db-deployment-version-selector.js";
import { DbEnvironmentResourceSelector } from "../selector/db-environment-resource.js";
import { DbPolicyTargetReleaseTargetSelector } from "../selector/db-policy-target-release-target.js";
import { SelectorManager } from "../selector/selector.js";
import { ReleaseTargetManager } from "./release-targets/manager.js";

type WorkspaceOptions = {
  id: string;
};

export class Workspace {
  static async load(id: string) {
    const ws = new Workspace({ id });

    return Promise.resolve(ws);
  }

  selectorManager: SelectorManager;
  releaseTargetManager: ReleaseTargetManager;

  constructor(private opts: WorkspaceOptions) {
    this.selectorManager = new SelectorManager({
      environmentResourceSelector: new DbEnvironmentResourceSelector({
        workspaceId: opts.id,
      }),
      deploymentResourceSelector: new DbDeploymentResourceSelector({
        workspaceId: opts.id,
      }),
      policyTargetReleaseTargetSelector:
        new DbPolicyTargetReleaseTargetSelector({
          workspaceId: opts.id,
        }),
      deploymentVersionSelector: new DbDeploymentVersionSelector({
        workspaceId: opts.id,
      }),
    });
    this.releaseTargetManager = new ReleaseTargetManager({
      workspaceId: opts.id,
      policyTargetReleaseTargetSelector:
        this.selectorManager.policyTargetReleaseTargetSelector,
    });
  }

  get id() {
    return this.opts.id;
  }
}

export class WorkspaceManager {
  private static result: Record<string, Workspace> = {};

  static async getOrLoad(id: string) {
    const workspace = WorkspaceManager.get(id);
    if (!workspace) {
      const ws = await Workspace.load(id);
      WorkspaceManager.set(id, ws);
    }

    return workspace;
  }

  static get(id: string) {
    return WorkspaceManager.result[id];
  }

  static set(id: string, workspace: Workspace) {
    WorkspaceManager.result[id] = workspace;
  }
}
