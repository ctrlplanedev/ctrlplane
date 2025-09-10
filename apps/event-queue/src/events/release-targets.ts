import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

export const evaluateReleaseTarget: Handler<
  Event.EvaluateReleaseTarget
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  await OperationPipeline.evaluate(ws)
    .releaseTargets([event.payload])
    .dispatch();
};
