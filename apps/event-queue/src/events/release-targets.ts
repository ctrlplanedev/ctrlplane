import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

export const evaluateReleaseTarget: Handler<
  Event.EvaluateReleaseTarget
> = async (event, ws) => {
  await OperationPipeline.evaluate(ws)
    .releaseTargets([event.payload.releaseTarget], event.payload.opts)
    .dispatch();
};
