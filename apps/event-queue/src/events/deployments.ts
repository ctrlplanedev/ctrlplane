import type { Event } from "@ctrlplane/events";

import { makeWithSpan, trace } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const newDeploymentTracer = trace.getTracer("new-deployment");
const withNewDeploymentSpan = makeWithSpan(newDeploymentTracer);

export const newDeployment: Handler<Event.DeploymentCreated> =
  withNewDeploymentSpan("new-deployment", async (span, event) => {
    span.setAttribute("deployment.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.update(ws).deployment(event.payload).dispatch();
  });

const updatedDeploymentTracer = trace.getTracer("updated-deployment");
const withUpdatedDeploymentSpan = makeWithSpan(updatedDeploymentTracer);

export const updatedDeployment: Handler<Event.DeploymentUpdated> =
  withUpdatedDeploymentSpan("updated-deployment", async (span, event) => {
    span.setAttribute("deployment.id", event.payload.current.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.update(ws)
      .deployment(event.payload.current)
      .dispatch();
  });

const deletedDeploymentTracer = trace.getTracer("deleted-deployment");
const withDeletedDeploymentSpan = makeWithSpan(deletedDeploymentTracer);

export const deletedDeployment: Handler<Event.DeploymentDeleted> =
  withDeletedDeploymentSpan("deleted-deployment", async (span, event) => {
    span.setAttribute("deployment.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.delete(ws).deployment(event.payload).dispatch();
  });
