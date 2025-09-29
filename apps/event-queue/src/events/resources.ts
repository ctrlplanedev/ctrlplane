import type { Event, FullResource } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

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

export const newResource: Handler<Event.ResourceCreated> = async (
  event,
  ws,
) => {
  const resource = getResourceWithDates(event.payload);
  await OperationPipeline.update(ws).resource(resource).dispatch();
};

export const updatedResource: Handler<Event.ResourceUpdated> = async (
  event,
  ws,
) => {
  const current = getResourceWithDates(event.payload.current);
  await OperationPipeline.update(ws).resource(current).dispatch();
};

export const deletedResource: Handler<Event.ResourceDeleted> = async (
  event,
  ws,
) => {
  await OperationPipeline.delete(ws).resource(event.payload).dispatch();
};

export const newResourceVariable: Handler<
  Event.ResourceVariableCreated
> = async (event, ws) => {
  await OperationPipeline.update(ws).resourceVariable(event.payload).dispatch();
};

export const updatedResourceVariable: Handler<
  Event.ResourceVariableUpdated
> = async (event, ws) => {
  await OperationPipeline.update(ws)
    .resourceVariable(event.payload.current)
    .dispatch();
};

export const deletedResourceVariable: Handler<
  Event.ResourceVariableDeleted
> = async (event, ws) => {
  await OperationPipeline.delete(ws).resourceVariable(event.payload).dispatch();
};
