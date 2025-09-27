import type { Event, FullResource } from "@ctrlplane/events";
import { trace } from "@opentelemetry/api";

import { makeWithSpan } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const getResourceWithDates = (resource: FullResource) => {
  const createdAt = new Date(resource.createdAt);
  const updatedAt =
    resource.updatedAt != null ? new Date(resource.updatedAt) : null;
  const lockedAt =
    resource.lockedAt != null ? new Date(resource.lockedAt) : null;
  const deletedAt =
    resource.deletedAt != null ? new Date(resource.deletedAt) : null;
  return { ...resource, createdAt, updatedAt, lockedAt, deletedAt };
};

const newResourceTracer = trace.getTracer("new-resource");
const withNewResourceSpan = makeWithSpan(newResourceTracer);

export const newResource: Handler<Event.ResourceCreated> = withNewResourceSpan(
  "new-resource",
  async (span, event) => {
    span.setAttribute("resource.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const resource = getResourceWithDates(event.payload);
    await OperationPipeline.update(ws).resource(resource).dispatch();
  },
);

const updatedResourceTracer = trace.getTracer("updated-resource");
const withUpdatedResourceSpan = makeWithSpan(updatedResourceTracer);

export const updatedResource: Handler<Event.ResourceUpdated> =
  withUpdatedResourceSpan("updated-resource", async (span, event) => {
    span.setAttribute("resource.id", event.payload.current.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const current = getResourceWithDates(event.payload.current);
    await OperationPipeline.update(ws).resource(current).dispatch();
  });

const deletedResourceTracer = trace.getTracer("deleted-resource");
const withDeletedResourceSpan = makeWithSpan(deletedResourceTracer);

export const deletedResource: Handler<Event.ResourceDeleted> =
  withDeletedResourceSpan("deleted-resource", async (span, event) => {
    span.setAttribute("resource.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.delete(ws).resource(event.payload).dispatch();
  });

const newResourceVariableTracer = trace.getTracer("new-resource-variable");
const withNewResourceVariableSpan = makeWithSpan(newResourceVariableTracer);

export const newResourceVariable: Handler<Event.ResourceVariableCreated> =
  withNewResourceVariableSpan("new-resource-variable", async (span, event) => {
    span.setAttribute("resource-variable.id", event.payload.id);
    span.setAttribute("resource.id", event.payload.resourceId);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.update(ws)
      .resourceVariable(event.payload)
      .dispatch();
  });

const updatedResourceVariableTracer = trace.getTracer(
  "updated-resource-variable",
);
const withUpdatedResourceVariableSpan = makeWithSpan(
  updatedResourceVariableTracer,
);

export const updatedResourceVariable: Handler<Event.ResourceVariableUpdated> =
  withUpdatedResourceVariableSpan(
    "updated-resource-variable",
    async (span, event) => {
      span.setAttribute("resource-variable.id", event.payload.current.id);
      span.setAttribute("resource.id", event.payload.current.resourceId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.update(ws)
        .resourceVariable(event.payload.current)
        .dispatch();
    },
  );

const deletedResourceVariableTracer = trace.getTracer(
  "deleted-resource-variable",
);
const withDeletedResourceVariableSpan = makeWithSpan(
  deletedResourceVariableTracer,
);

export const deletedResourceVariable: Handler<Event.ResourceVariableDeleted> =
  withDeletedResourceVariableSpan(
    "deleted-resource-variable",
    async (span, event) => {
      span.setAttribute("resource-variable.id", event.payload.id);
      span.setAttribute("resource.id", event.payload.resourceId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      await OperationPipeline.delete(ws)
        .resourceVariable(event.payload)
        .dispatch();
    },
  );
