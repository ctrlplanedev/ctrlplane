import type { Span } from "@ctrlplane/logger";

import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";
import { getFullReleaseTarget } from "./util.js";

export const dispatchRedeploy = createSpanWrapper(
  "dispatchRedeploy",
  async (span: Span, releaseTargetId: string) => {
    span.setAttribute("releaseTarget.id", releaseTargetId);

    const releaseTarget = await getFullReleaseTarget(releaseTargetId);
    span.setAttribute("workspace.id", releaseTarget.resource.workspaceId);
    span.setAttribute("deployment.id", releaseTarget.deployment.id);
    span.setAttribute("environment.id", releaseTarget.environment.id);
    span.setAttribute("resource.id", releaseTarget.resource.id);

    await sendGoEvent({
      workspaceId: releaseTarget.resource.workspaceId,
      eventType: Event.Redeploy,
      data: releaseTarget,
      timestamp: Date.now(),
    });
  },
);
