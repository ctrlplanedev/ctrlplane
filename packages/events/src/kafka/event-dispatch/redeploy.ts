import type { Span } from "@ctrlplane/logger";

import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchRedeploy = createSpanWrapper(
  "dispatchRedeploy",
  async (span: Span, workspaceId: string, releaseTargetId: string) => {
    span.setAttribute("releaseTarget.id", releaseTargetId);

    await sendGoEvent({
      workspaceId: workspaceId,
      eventType: Event.Redeploy,
      data: releaseTargetId,
      timestamp: Date.now(),
    });
  },
);
