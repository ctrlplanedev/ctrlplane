import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newPolicy: Handler<Event.PolicyCreated> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).policy(event.payload).dispatch();
};

export const updatedPolicy: Handler<Event.PolicyUpdated> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).policy(event.payload.current).dispatch();
};

export const deletedPolicy: Handler<Event.PolicyDeleted> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.delete(ws).policy(event.payload).dispatch();
};
