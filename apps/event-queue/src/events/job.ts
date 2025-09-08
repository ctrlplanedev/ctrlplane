import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const updateJob: Handler<Event.JobUpdated> = async (event) => {
  const { current } = event.payload;
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.update(ws).job(current).dispatch();
};
