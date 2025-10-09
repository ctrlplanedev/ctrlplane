import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import * as PB from "../../workspace-engine/types/index.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getSystem = async (tx: Tx, systemId: string) =>
  tx
    .select()
    .from(schema.system)
    .where(eq(schema.system.id, systemId))
    .then(takeFirst);

const convertEnvironmentToNodeEvent = (
  environment: schema.Environment,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.EnvironmentCreated,
  eventId: environment.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: environment,
});

const getPbEnvironment = (environment: schema.Environment): PB.Environment => ({
  id: environment.id,
  name: environment.name,
  description: environment.description ?? undefined,
  systemId: environment.systemId,
  resourceSelector: PB.wrapSelector(environment.resourceSelector),
  createdAt: environment.createdAt.toISOString(),
});

const convertEnvironmentToGoEvent = (
  environment: schema.Environment,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.EnvironmentCreated as const,
  data: getPbEnvironment(environment),
  timestamp: Date.now(),
});

export const dispatchEnvironmentCreated = async (
  environment: schema.Environment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, environment.systemId);

  await Promise.all([
    sendNodeEvent(
      convertEnvironmentToNodeEvent(environment, system.workspaceId),
    ),
    sendGoEvent(convertEnvironmentToGoEvent(environment, system.workspaceId)),
  ]);
};

export const dispatchEnvironmentUpdated = async (
  previous: schema.Environment,
  current: schema.Environment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, current.systemId);

  await Promise.all([
    sendNodeEvent({
      workspaceId: system.workspaceId,
      eventType: Event.EnvironmentUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: source ?? "api",
      payload: { previous, current },
    }),
    sendGoEvent(convertEnvironmentToGoEvent(current, system.workspaceId)),
  ]);
};

export const dispatchEnvironmentDeleted = async (
  environment: schema.Environment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, environment.systemId);

  await Promise.all([
    sendNodeEvent(
      convertEnvironmentToNodeEvent(environment, system.workspaceId),
    ),
    sendGoEvent(convertEnvironmentToGoEvent(environment, system.workspaceId)),
  ]);
};
