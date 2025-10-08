import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getWorkspaceId = async (tx: Tx, deploymentVersionId: string) =>
  tx
    .select()
    .from(schema.deploymentVersion)
    .innerJoin(
      schema.deployment,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
    )
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .where(eq(schema.deploymentVersion.id, deploymentVersionId))
    .then(takeFirst)
    .then((row) => row.system.workspaceId);

export const dispatchDeploymentVersionCreated = async (
  deploymentVersion: schema.DeploymentVersion,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const workspaceId = await getWorkspaceId(tx, deploymentVersion.id);

  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVersionCreated,
    eventId: deploymentVersion.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deploymentVersion,
  });
};

export const dispatchDeploymentVersionUpdated = async (
  previous: schema.DeploymentVersion,
  current: schema.DeploymentVersion,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const workspaceId = await getWorkspaceId(tx, current.id);

  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVersionUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
};

export const dispatchDeploymentVersionDeleted = async (
  deploymentVersion: schema.DeploymentVersion,
  source?: "api" | "scheduler" | "user-action",
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const workspaceId = await getWorkspaceId(tx, deploymentVersion.id);

  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVersionDeleted,
    eventId: deploymentVersion.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deploymentVersion,
  });
};
