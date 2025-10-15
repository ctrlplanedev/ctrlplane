import type { Tx } from "@ctrlplane/db";
import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event } from "../events.js";
import { convertToOapiSelector } from "./util.js";

const getSystem = async (tx: Tx, systemId: string) =>
  tx
    .select()
    .from(schema.system)
    .where(eq(schema.system.id, systemId))
    .then(takeFirst);

const convertEnvironmentToNodeEvent = (
  environment: schema.Environment,
  workspaceId: string,
  eventType: Event,
) => ({
  workspaceId,
  eventType,
  eventId: environment.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: environment,
});

const getOapiEnvironment = (
  environment: schema.Environment,
): WorkspaceEngine["schemas"]["Environment"] => ({
  id: environment.id,
  name: environment.name,
  description: environment.description ?? undefined,
  systemId: environment.systemId,
  resourceSelector: convertToOapiSelector(environment.resourceSelector),
  createdAt: environment.createdAt.toISOString(),
});

const convertEnvironmentToGoEvent = (
  environment: schema.Environment,
  workspaceId: string,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId,
  eventType,
  data: getOapiEnvironment(environment),
  timestamp: Date.now(),
});

export const dispatchEnvironmentCreated = createSpanWrapper(
  "dispatchEnvironmentCreated",
  async (
    span: Span,
    environment: schema.Environment,
    source?: "api" | "scheduler" | "user-action",
    db?: Tx,
  ) => {
    span.setAttribute("environment.id", environment.id);
    span.setAttribute("environment.name", environment.name);
    span.setAttribute("system.id", environment.systemId);

    const tx = db ?? dbClient;
    const system = await getSystem(tx, environment.systemId);
    span.setAttribute("workspace.id", system.workspaceId);

    const eventType = Event.EnvironmentCreated;
    await sendNodeEvent(
      convertEnvironmentToNodeEvent(environment, system.workspaceId, eventType),
    );
    await sendGoEvent(
      convertEnvironmentToGoEvent(
        environment,
        system.workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchEnvironmentUpdated = createSpanWrapper(
  "dispatchEnvironmentUpdated",
  async (
    span: Span,
    previous: schema.Environment,
    current: schema.Environment,
    source?: "api" | "scheduler" | "user-action",
    db?: Tx,
  ) => {
    span.setAttribute("environment.id", current.id);
    span.setAttribute("environment.name", current.name);
    span.setAttribute("system.id", current.systemId);

    const tx = db ?? dbClient;
    const system = await getSystem(tx, current.systemId);
    span.setAttribute("workspace.id", system.workspaceId);

    const eventType = Event.EnvironmentUpdated;
    await sendNodeEvent({
      workspaceId: system.workspaceId,
      eventType,
      eventId: current.id,
      timestamp: Date.now(),
      source: source ?? "api",
      payload: { previous, current },
    });
    await sendGoEvent(
      convertEnvironmentToGoEvent(
        current,
        system.workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchEnvironmentDeleted = createSpanWrapper(
  "dispatchEnvironmentDeleted",
  async (
    span: Span,
    environment: schema.Environment,
    source?: "api" | "scheduler" | "user-action",
    db?: Tx,
  ) => {
    span.setAttribute("environment.id", environment.id);
    span.setAttribute("environment.name", environment.name);
    span.setAttribute("system.id", environment.systemId);

    const tx = db ?? dbClient;
    const system = await getSystem(tx, environment.systemId);
    span.setAttribute("workspace.id", system.workspaceId);

    const eventType = Event.EnvironmentDeleted;
    await sendNodeEvent(
      convertEnvironmentToNodeEvent(environment, system.workspaceId, eventType),
    );
    await sendGoEvent(
      convertEnvironmentToGoEvent(
        environment,
        system.workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);
