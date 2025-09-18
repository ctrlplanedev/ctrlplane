import type * as schema from "@ctrlplane/db/schema";
import type { Event } from "@ctrlplane/events";
import { trace } from "@opentelemetry/api";

import { makeWithSpan } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const getResourceWithDates = (resource: schema.Resource) => {
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
const withSpan = makeWithSpan(newResourceTracer);

export const newResource: Handler<Event.ResourceCreated> = withSpan(
  "new-resource",
  async (span, event) => {
    span.setAttribute("resource.id", event.payload.id);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const resource = getResourceWithDates(event.payload);
    await OperationPipeline.update(ws).resource(resource).dispatch();
  },
);

export const updatedResource: Handler<Event.ResourceUpdated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const current = getResourceWithDates(event.payload.current);
  await OperationPipeline.update(ws).resource(current).dispatch();
};

export const deletedResource: Handler<Event.ResourceDeleted> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).resource(event.payload).dispatch();
};

export const newResourceVariable: Handler<
  Event.ResourceVariableCreated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).resourceVariable(event.payload).dispatch();
};

export const updatedResourceVariable: Handler<
  Event.ResourceVariableUpdated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .resourceVariable(event.payload.current)
    .dispatch();
};

export const deletedResourceVariable: Handler<
  Event.ResourceVariableDeleted
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).resourceVariable(event.payload).dispatch();
};
