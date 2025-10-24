import type { Span } from "@ctrlplane/logger";
import { createSpanWrapper } from "src/span";

import type { FullReleaseTarget } from "../events.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchRedeploy = createSpanWrapper(
  "dispatchRedeploy",
  async (span: Span, releaseTarget: FullReleaseTarget) => {
    span.setAttribute("releaseTarget.id", releaseTarget.id);

    await sendGoEvent({
      workspaceId: releaseTarget.resource.workspaceId,
      eventType: Event.Redeploy,
      data: releaseTarget,
      timestamp: Date.now(),
    });
  },
);
