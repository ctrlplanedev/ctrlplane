import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getSystem = async (tx: Tx, systemId: string) =>
  tx
    .select()
    .from(schema.system)
    .where(eq(schema.system.id, systemId))
    .then(takeFirst);

export const dispatchDeploymentCreated = async (
  deployment: schema.Deployment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, deployment.systemId);

  await sendNodeEvent({
    workspaceId: system.workspaceId,
    eventType: Event.DeploymentCreated,
    eventId: deployment.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deployment,
  });
};

export const dispatchDeploymentUpdated = async (
  previous: schema.Deployment,
  current: schema.Deployment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, current.systemId);

  await sendNodeEvent({
    workspaceId: system.workspaceId,
    eventType: Event.DeploymentUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
};

export const dispatchDeploymentDeleted = async (
  deployment: schema.Deployment,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, deployment.systemId);

  await sendNodeEvent({
    workspaceId: system.workspaceId,
    eventType: Event.DeploymentDeleted,
    eventId: deployment.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deployment,
  });
};
