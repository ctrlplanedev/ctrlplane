import type * as schema from "@ctrlplane/db/schema";

import { sendEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchJobUpdated = (
  previous: schema.Job,
  current: schema.Job,
  workspaceId: string,
  source?: "api" | "scheduler" | "user-action",
) =>
  sendEvent({
    workspaceId,
    eventType: Event.JobUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
