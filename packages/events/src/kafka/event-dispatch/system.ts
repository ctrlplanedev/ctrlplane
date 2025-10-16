import type * as schema from "@ctrlplane/db/schema";
import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import type { GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent } from "../client.js";
import { Event } from "../events.js";

const getOapiSystem = (
  system: schema.System,
): WorkspaceEngine["schemas"]["System"] => ({
  id: system.id,
  workspaceId: system.workspaceId,
  name: system.name,
  description: system.description,
});

const convertSystemToGoEvent = (
  system: schema.System,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId: system.workspaceId,
  eventType,
  data: getOapiSystem(system),
  timestamp: Date.now(),
});

export const dispatchSystemCreated = createSpanWrapper(
  "dispatchSystemCreated",
  async (span: Span, system: schema.System) => {
    span.setAttribute("system.id", system.id);
    span.setAttribute("system.workspaceId", system.workspaceId);
    span.setAttribute("system.name", system.name);
    span.setAttribute("system.description", system.description);

    await sendGoEvent(convertSystemToGoEvent(system, Event.SystemCreated));
  },
);

export const dispatchSystemUpdated = createSpanWrapper(
  "dispatchSystemUpdated",
  async (span: Span, system: schema.System) => {
    span.setAttribute("system.id", system.id);
    span.setAttribute("system.workspaceId", system.workspaceId);
    span.setAttribute("system.name", system.name);
    span.setAttribute("system.description", system.description);

    await sendGoEvent(convertSystemToGoEvent(system, Event.SystemUpdated));
  },
);

export const dispatchSystemDeleted = createSpanWrapper(
  "dispatchSystemDeleted",
  async (span: Span, system: schema.System) => {
    span.setAttribute("system.id", system.id);
    span.setAttribute("system.workspaceId", system.workspaceId);
    span.setAttribute("system.name", system.name);
    span.setAttribute("system.description", system.description);

    await sendGoEvent(convertSystemToGoEvent(system, Event.SystemDeleted));
  },
);
