import { DeploymentStore } from "./deployment-store.js";
import { EnvironmentStore } from "./environment-store.js";
import { ResourceStore } from "./resource-store.js";

const workspaceStates = new Map<string, WorkspaceStore>();

export const getWorkspaceStore = (workspaceId: string): WorkspaceStore => {
  if (!workspaceStates.has(workspaceId)) {
    workspaceStates.set(workspaceId, new WorkspaceStore());
  }
  return workspaceStates.get(workspaceId)!;
};

export class WorkspaceStore {
  public resources = new ResourceStore();
  public environments = new EnvironmentStore();
  public deployments = new DeploymentStore();
}
