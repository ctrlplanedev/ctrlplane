import { SelectorManager } from "../selector/selector.js";
import { ReleaseTargetManager } from "./release-targets/manager.js";

type WorkspaceOptions = {
  id: string;
};

export class Workspace {
  static async load(_: string) {
    const ws = new Workspace();

    return Promise.resolve(ws);
  }

  selectorManager: SelectorManager;
  releaseTargetManager: ReleaseTargetManager;

  constructor(private opts?: WorkspaceOptions) {
    this.selectorManager = new SelectorManager({});
    this.releaseTargetManager = new ReleaseTargetManager({
      workspaceId: opts?.id ?? "",
    });
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
