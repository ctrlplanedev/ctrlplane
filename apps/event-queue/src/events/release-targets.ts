import type { Event } from "@ctrlplane/events";

import { makeWithSpan, trace } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const evaluateReleaseTargetTracer = trace.getTracer("evaluate-release-target");
const withSpan = makeWithSpan(evaluateReleaseTargetTracer);

export const evaluateReleaseTarget: Handler<Event.EvaluateReleaseTarget> =
  withSpan("evaluate-release-target", async (span, event) => {
    span.setAttribute("event.type", event.eventType);
    span.setAttribute("releaseTarget.id", event.payload.releaseTarget.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.evaluate(ws)
      .releaseTargets([event.payload.releaseTarget], event.payload.opts)
      .dispatch();
  });
