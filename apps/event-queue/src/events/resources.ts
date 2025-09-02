import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newResource: Handler<Event.ResourceCreated> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).resource(event.payload).dispatch();
};

export const updatedResource: Handler<Event.ResourceUpdated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).resource(event.payload.current).dispatch();
};

export const deletedResource: Handler<Event.ResourceDeleted> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).resource(event.payload).dispatch();
};
