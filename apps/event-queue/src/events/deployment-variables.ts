import type { Event } from "@ctrlplane/events";

import { makeWithSpan, trace } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const newDeploymentVariableTracer = trace.getTracer("new-deployment-variable");
const withNewDeploymentVariableSpan = makeWithSpan(newDeploymentVariableTracer);

export const newDeploymentVariable: Handler<Event.DeploymentVariableCreated> =
  withNewDeploymentVariableSpan(
    "new-deployment-variable",
    async (span, event) => {
      span.setAttribute("event.type", event.eventType);
      span.setAttribute("deployment-variable.id", event.payload.id);
      span.setAttribute("deployment.id", event.payload.deploymentId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .deploymentVariable(event.payload)
        .dispatch();
    },
  );

const updatedDeploymentVariableTracer = trace.getTracer(
  "updated-deployment-variable",
);
const withUpdatedDeploymentVariableSpan = makeWithSpan(
  updatedDeploymentVariableTracer,
);

export const updatedDeploymentVariable: Handler<Event.DeploymentVariableUpdated> =
  withUpdatedDeploymentVariableSpan(
    "updated-deployment-variable",
    async (span, event) => {
      span.setAttribute("event.type", event.eventType);
      span.setAttribute("deployment-variable.id", event.payload.current.id);
      span.setAttribute("deployment.id", event.payload.current.deploymentId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .deploymentVariable(event.payload.current)
        .dispatch();
    },
  );

const deletedDeploymentVariableTracer = trace.getTracer(
  "deleted-deployment-variable",
);
const withDeletedDeploymentVariableSpan = makeWithSpan(
  deletedDeploymentVariableTracer,
);

export const deletedDeploymentVariable: Handler<Event.DeploymentVariableDeleted> =
  withDeletedDeploymentVariableSpan(
    "deleted-deployment-variable",
    async (span, event) => {
      span.setAttribute("event.type", event.eventType);
      span.setAttribute("deployment-variable.id", event.payload.id);
      span.setAttribute("deployment.id", event.payload.deploymentId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .deploymentVariable(event.payload)
        .dispatch();
    },
  );

const newDeploymentVariableValueTracer = trace.getTracer(
  "new-deployment-variable-value",
);
const withNewDeploymentVariableValueSpan = makeWithSpan(
  newDeploymentVariableValueTracer,
);

export const newDeploymentVariableValue: Handler<Event.DeploymentVariableValueCreated> =
  withNewDeploymentVariableValueSpan(
    "new-deployment-variable-value",
    async (span, event) => {
      span.setAttribute("deployment-variable-value.id", event.payload.id);
      span.setAttribute("deployment-variable.id", event.payload.variableId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .deploymentVariableValue(event.payload)
        .dispatch();
    },
  );

const updatedDeploymentVariableValueTracer = trace.getTracer(
  "updated-deployment-variable-value",
);
const withUpdatedDeploymentVariableValueSpan = makeWithSpan(
  updatedDeploymentVariableValueTracer,
);

export const updatedDeploymentVariableValue: Handler<Event.DeploymentVariableValueUpdated> =
  withUpdatedDeploymentVariableValueSpan(
    "updated-deployment-variable-value",
    async (span, event) => {
      span.setAttribute("event.type", event.eventType);
      span.setAttribute(
        "deployment-variable-value.id",
        event.payload.current.id,
      );
      span.setAttribute(
        "deployment-variable.id",
        event.payload.current.variableId,
      );
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .deploymentVariableValue(event.payload.current)
        .dispatch();
    },
  );

const deletedDeploymentVariableValueTracer = trace.getTracer(
  "deleted-deployment-variable-value",
);
const withDeletedDeploymentVariableValueSpan = makeWithSpan(
  deletedDeploymentVariableValueTracer,
);

export const deletedDeploymentVariableValue: Handler<Event.DeploymentVariableValueDeleted> =
  withDeletedDeploymentVariableValueSpan(
    "deleted-deployment-variable-value",
    async (span, event) => {
      span.setAttribute("event.type", event.eventType);
      span.setAttribute("deployment-variable-value.id", event.payload.id);
      span.setAttribute("deployment-variable.id", event.payload.variableId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .deploymentVariableValue(event.payload)
        .dispatch();
    },
  );
