import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

export const newDeploymentVariable: Handler<
  Event.DeploymentVariableCreated
> = async (event, ws, span) => {
  span.setAttribute("event.type", event.eventType);
  span.setAttribute("deployment-variable.id", event.payload.id);
  span.setAttribute("deployment.id", event.payload.deploymentId);
  span.setAttribute("workspace.id", event.workspaceId);
  await OperationPipeline.update(ws)
    .deploymentVariable(event.payload)
    .dispatch();
};

export const updatedDeploymentVariable: Handler<
  Event.DeploymentVariableUpdated
> = async (event, ws, span) => {
  span.setAttribute("deployment-variable.id", event.payload.current.id);
  span.setAttribute("deployment.id", event.payload.current.deploymentId);

  await OperationPipeline.update(ws)
    .deploymentVariable(event.payload.current)
    .dispatch();
};

export const deletedDeploymentVariable: Handler<
  Event.DeploymentVariableDeleted
> = async (event, ws, span) => {
  span.setAttribute("deployment.id", event.payload.deploymentId);

  await OperationPipeline.delete(ws)
    .deploymentVariable(event.payload)
    .dispatch();
};

export const newDeploymentVariableValue: Handler<
  Event.DeploymentVariableValueCreated
> = async (event, ws, span) => {
  span.setAttribute("deployment-variable-value.id", event.payload.id);
  span.setAttribute("deployment-variable.id", event.payload.variableId);

  await OperationPipeline.update(ws)
    .deploymentVariableValue(event.payload)
    .dispatch();
};

export const updatedDeploymentVariableValue: Handler<
  Event.DeploymentVariableValueUpdated
> = async (event, ws, span) => {
  span.setAttribute("deployment-variable-value.id", event.payload.current.id);
  span.setAttribute("deployment-variable.id", event.payload.current.variableId);

  await OperationPipeline.update(ws)
    .deploymentVariableValue(event.payload.current)
    .dispatch();
};

export const deletedDeploymentVariableValue: Handler<
  Event.DeploymentVariableValueDeleted
> = async (event, ws, span) => {
  span.setAttribute("deployment-variable.id", event.payload.variableId);

  await OperationPipeline.delete(ws)
    .deploymentVariableValue(event.payload)
    .dispatch();
};
