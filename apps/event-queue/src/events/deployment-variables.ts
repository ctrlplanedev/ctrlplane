import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newDeploymentVariable: Handler<
  Event.DeploymentVariableCreated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVariable(event.payload)
    .dispatch();
};

export const updatedDeploymentVariable: Handler<
  Event.DeploymentVariableUpdated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVariable(event.payload.current)
    .dispatch();
};

export const deletedDeploymentVariable: Handler<
  Event.DeploymentVariableDeleted
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVariable(event.payload)
    .dispatch();
};

export const newDeploymentVariableValue: Handler<
  Event.DeploymentVariableValueCreated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVariableValue(event.payload)
    .dispatch();
};

export const updatedDeploymentVariableValue: Handler<
  Event.DeploymentVariableValueUpdated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVariableValue(event.payload.current)
    .dispatch();
};

export const deletedDeploymentVariableValue: Handler<
  Event.DeploymentVariableValueDeleted
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .deploymentVariableValue(event.payload)
    .dispatch();
};
