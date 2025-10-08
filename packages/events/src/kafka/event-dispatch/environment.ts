import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendNodeEvent } from "../client.js";
import { Event, wrapSelectorsInObject } from "../events.js";

const getSystem = async (tx: Tx, systemId: string) =>
  tx
    .select()
    .from(schema.system)
    .where(eq(schema.system.id, systemId))
    .then(takeFirst);

export const dispatchEnvironmentCreated = async (
  environment: schema.Environment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, environment.systemId);

  await sendNodeEvent({
    workspaceId: system.workspaceId,
    eventType: Event.EnvironmentCreated,
    eventId: environment.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: wrapSelectorsInObject(environment, ["resourceSelector"]),
  });
};

export const dispatchEnvironmentUpdated = async (
  previous: schema.Environment,
  current: schema.Environment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, current.systemId);

  await sendNodeEvent({
    workspaceId: system.workspaceId,
    eventType: Event.EnvironmentUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: {
      previous: wrapSelectorsInObject(previous, ["resourceSelector"]),
      current: wrapSelectorsInObject(current, ["resourceSelector"]),
    },
  });
};

export const dispatchEnvironmentDeleted = async (
  environment: schema.Environment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, environment.systemId);

  await sendNodeEvent({
    workspaceId: system.workspaceId,
    eventType: Event.EnvironmentDeleted,
    eventId: environment.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: wrapSelectorsInObject(environment, ["resourceSelector"]),
  });
};
