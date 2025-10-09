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

const convertDeploymentToNodeEvent = (
  deployment: schema.Deployment,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.DeploymentCreated,
  eventId: deployment.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: deployment,
});

const getPbDeployment = (deployment: schema.Deployment): PB.Deployment => ({
  id: deployment.id,
  name: deployment.name,
  slug: deployment.slug,
  description: deployment.description,
  systemId: deployment.systemId,
  jobAgentId: deployment.jobAgentId ?? undefined,
  jobAgentConfig: deployment.jobAgentConfig,
  resourceSelector: PB.wrapSelector(deployment.resourceSelector),
});

const convertDeploymentToGoEvent = (
  deployment: schema.Deployment,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.DeploymentCreated as const,
  data: getPbDeployment(deployment),
  timestamp: Date.now(),
});

export const dispatchDeploymentCreated = async (
  deployment: schema.Deployment,
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, deployment.systemId);

  await Promise.all([
    sendNodeEvent(convertDeploymentToNodeEvent(deployment, system.workspaceId)),
    sendGoEvent(convertDeploymentToGoEvent(deployment, system.workspaceId)),
  ]);
};

export const dispatchDeploymentUpdated = async (
  previous: schema.Deployment,
  current: schema.Deployment,
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, current.systemId);

  await Promise.all([
    sendNodeEvent({
      workspaceId: system.workspaceId,
      eventType: Event.DeploymentUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api" as const,
      payload: { previous, current },
    }),
    sendGoEvent(convertDeploymentToGoEvent(current, system.workspaceId)),
  ]);
};

export const dispatchDeploymentDeleted = async (
  deployment: schema.Deployment,
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const system = await getSystem(tx, deployment.systemId);
  await Promise.all([
    sendNodeEvent(convertDeploymentToNodeEvent(deployment, system.workspaceId)),
    sendGoEvent(convertDeploymentToGoEvent(deployment, system.workspaceId)),
  ]);
};
