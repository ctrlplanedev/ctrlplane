import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newEnvironment: Handler<Event.EnvironmentCreated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).environment(event.payload).dispatch();
};

export const updatedEnvironment: Handler<Event.EnvironmentUpdated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws)
    .environment(event.payload.current)
    .dispatch();
};

export const deletedEnvironment: Handler<Event.EnvironmentDeleted> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).environment(event.payload).dispatch();
};
