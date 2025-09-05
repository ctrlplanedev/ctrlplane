import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newDeploymentVersion: Handler<
  Event.DeploymentVersionCreated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVersion(event.payload)
    .dispatch();
};

export const updatedDeploymentVersion: Handler<
  Event.DeploymentVersionUpdated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVersion(event.payload.current)
    .dispatch();
};

export const deletedDeploymentVersion: Handler<
  Event.DeploymentVersionDeleted
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws)
    .deploymentVersion(event.payload)
    .dispatch();
};
