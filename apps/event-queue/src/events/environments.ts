import type { Event } from "@ctrlplane/events";

import { makeWithSpan, trace } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const newEnvironmentTracer = trace.getTracer("new-environment");
const withNewEnvironmentSpan = makeWithSpan(newEnvironmentTracer);

export const newEnvironment: Handler<Event.EnvironmentCreated> =
  withNewEnvironmentSpan("new-environment", async (span, event) => {
    span.setAttribute("environment.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const createdAt = new Date(event.payload.createdAt);
    const environment = { ...event.payload, createdAt };
    await OperationPipeline.update(ws).environment(environment).dispatch();
  });

const updatedEnvironmentTracer = trace.getTracer("updated-environment");
const withUpdatedEnvironmentSpan = makeWithSpan(updatedEnvironmentTracer);

export const updatedEnvironment: Handler<Event.EnvironmentUpdated> =
  withUpdatedEnvironmentSpan("updated-environment", async (span, event) => {
    span.setAttribute("environment.id", event.payload.current.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const createdAt = new Date(event.payload.current.createdAt);
    const environment = { ...event.payload.current, createdAt };
    await OperationPipeline.update(ws).environment(environment).dispatch();
  });

const deletedEnvironmentTracer = trace.getTracer("deleted-environment");
const withDeletedEnvironmentSpan = makeWithSpan(deletedEnvironmentTracer);

export const deletedEnvironment: Handler<Event.EnvironmentDeleted> =
  withDeletedEnvironmentSpan("deleted-environment", async (span, event) => {
    span.setAttribute("environment.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.delete(ws).environment(event.payload).dispatch();
  });
