import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchRedeploy = createSpanWrapper(
  "dispatchRedeploy",
  async (
    span: Span,
    workspaceId: string,
    releaseTarget: WorkspaceEngine["schemas"]["ReleaseTarget"],
  ) => {
    span.setAttribute("deployment.id", releaseTarget.deploymentId);
    span.setAttribute("environment.id", releaseTarget.environmentId);
    span.setAttribute("resource.id", releaseTarget.resourceId);

    await sendGoEvent({
      workspaceId: workspaceId,
      eventType: Event.Redeploy,
      data: releaseTarget,
      timestamp: Date.now(),
    });
  },
);
