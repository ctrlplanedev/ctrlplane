import type * as schema from "@ctrlplane/db/schema";
import type { Span } from "@ctrlplane/logger";

import { createSpanWrapper } from "../../span.js";
import { sendNodeEvent } from "../client.js";
import { Event } from "../events.js";
import { getFullReleaseTarget } from "./util.js";

export const dispatchEvaluateReleaseTarget = createSpanWrapper(
  "dispatchEvaluateReleaseTarget",
  async (
    span: Span,
    releaseTarget: schema.ReleaseTarget,
    opts?: { skipDuplicateCheck?: boolean },
    source?: "api" | "scheduler" | "user-action",
  ) => {
    span.setAttribute("releaseTarget.id", releaseTarget.id);
    span.setAttribute("deployment.id", releaseTarget.deploymentId);
    span.setAttribute("environment.id", releaseTarget.environmentId);

    const fullReleaseTarget = await getFullReleaseTarget(releaseTarget.id);
    span.setAttribute("workspace.id", fullReleaseTarget.resource.workspaceId);

    await sendNodeEvent({
      workspaceId: fullReleaseTarget.resource.workspaceId,
      eventType: Event.EvaluateReleaseTarget,
      eventId: fullReleaseTarget.id,
      timestamp: Date.now(),
      source: source ?? "api",
      payload: { releaseTarget: fullReleaseTarget, opts },
    });
  },
);
