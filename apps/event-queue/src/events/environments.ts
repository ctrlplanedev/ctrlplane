import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newEnvironment: Handler<Event.EnvironmentCreated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const createdAt = new Date(event.payload.createdAt);
  const environment = { ...event.payload, createdAt };
  await OperationPipeline.update(ws).environment(environment).dispatch();
};

export const updatedEnvironment: Handler<Event.EnvironmentUpdated> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const createdAt = new Date(event.payload.current.createdAt);
  const environment = { ...event.payload.current, createdAt };
  await OperationPipeline.update(ws).environment(environment).dispatch();
};

export const deletedEnvironment: Handler<Event.EnvironmentDeleted> = async (
  event,
) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).environment(event.payload).dispatch();
};
