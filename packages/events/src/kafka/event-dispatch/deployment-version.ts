import type { Tx } from "@ctrlplane/db";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendGoEvent, sendNodeEvent } from "../client.js";
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

const convertVersionToNodeEvent = (
  deploymentVersion: schema.DeploymentVersion,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.DeploymentVersionCreated,
  eventId: deploymentVersion.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: deploymentVersion,
});

const getOapiDeploymentVersion = (
  deploymentVersion: schema.DeploymentVersion,
): WorkspaceEngine["schemas"]["DeploymentVersion"] => ({
  id: deploymentVersion.id,
  name: deploymentVersion.name,
  tag: deploymentVersion.tag,
  config: deploymentVersion.config,
  jobAgentConfig: deploymentVersion.jobAgentConfig,
  deploymentId: deploymentVersion.deploymentId,
  status: deploymentVersion.status,
  message: deploymentVersion.message ?? undefined,
  createdAt: deploymentVersion.createdAt.toISOString(),
});

const convertVersionToGoEvent = (
  deploymentVersion: schema.DeploymentVersion,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.DeploymentVersionCreated as const,
  data: getOapiDeploymentVersion(deploymentVersion),
  timestamp: Date.now(),
});

export const dispatchDeploymentVersionCreated = async (
  deploymentVersion: schema.DeploymentVersion,
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const workspaceId = await getWorkspaceId(tx, deploymentVersion.id);

  await Promise.all([
    // sendNodeEvent(convertVersionToNodeEvent(deploymentVersion, workspaceId)),
    sendGoEvent(convertVersionToGoEvent(deploymentVersion, workspaceId)),
  ]);
};

export const dispatchDeploymentVersionUpdated = async (
  previous: schema.DeploymentVersion,
  current: schema.DeploymentVersion,
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const workspaceId = await getWorkspaceId(tx, current.id);

  await Promise.all([
    sendNodeEvent({
      workspaceId,
      eventType: Event.DeploymentVersionUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api" as const,
      payload: { previous, current },
    }),
    sendGoEvent(convertVersionToGoEvent(current, workspaceId)),
  ]);
};

export const dispatchDeploymentVersionDeleted = async (
  deploymentVersion: schema.DeploymentVersion,
  db?: Tx,
) => {
  const tx = db ?? dbClient;
  const workspaceId = await getWorkspaceId(tx, deploymentVersion.id);

  await Promise.all([
    sendNodeEvent(convertVersionToNodeEvent(deploymentVersion, workspaceId)),
    sendGoEvent(convertVersionToGoEvent(deploymentVersion, workspaceId)),
  ]);
};
