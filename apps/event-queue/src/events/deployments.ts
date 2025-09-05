import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newDeployment: Handler<Event.DeploymentCreated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).deployment(event.payload).dispatch();
};

export const updatedDeployment: Handler<Event.DeploymentUpdated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deployment(event.payload.current)
    .dispatch();
};

export const deletedDeployment: Handler<Event.DeploymentDeleted> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).deployment(event.payload).dispatch();
};
