import { sendEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchReconcileWorkspace = async (workspaceId: string) =>
  sendEvent({
    workspaceId,
    eventType: Event.ReconcileWorkspace,
    eventId: workspaceId,
    timestamp: Date.now(),
    source: "api",
    payload: undefined,
  });
