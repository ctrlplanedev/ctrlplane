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
  eventType: Event,
) => ({
  workspaceId,
  eventType,
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
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId,
  eventType,
  data: getOapiDeploymentVersion(deploymentVersion),
  timestamp: Date.now(),
});

export const dispatchDeploymentVersionCreated = createSpanWrapper(
  "dispatchDeploymentVersionCreated",
  async (span: Span, deploymentVersion: schema.DeploymentVersion, db?: Tx) => {
    span.setAttribute("deploymentVersion.id", deploymentVersion.id);
    span.setAttribute("deploymentVersion.name", deploymentVersion.name);
    span.setAttribute("deployment.id", deploymentVersion.deploymentId);

    const tx = db ?? dbClient;
    const workspaceId = await getWorkspaceId(tx, deploymentVersion.id);
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.DeploymentVersionCreated;
    await sendNodeEvent(
      convertVersionToNodeEvent(deploymentVersion, workspaceId, eventType),
    );
    await sendGoEvent(
      convertVersionToGoEvent(
        deploymentVersion,
        workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchDeploymentVersionUpdated = createSpanWrapper(
  "dispatchDeploymentVersionUpdated",
  async (
    span: Span,
    previous: schema.DeploymentVersion,
    current: schema.DeploymentVersion,
    db?: Tx,
  ) => {
    span.setAttribute("deploymentVersion.id", current.id);
    span.setAttribute("deploymentVersion.name", current.name);
    span.setAttribute("deployment.id", current.deploymentId);

    const tx = db ?? dbClient;
    const workspaceId = await getWorkspaceId(tx, current.id);
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.DeploymentVersionUpdated;
    await sendNodeEvent({
      workspaceId,
      eventType,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api" as const,
      payload: { previous, current },
    });
    await sendGoEvent(
      convertVersionToGoEvent(
        current,
        workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchDeploymentVersionDeleted = createSpanWrapper(
  "dispatchDeploymentVersionDeleted",
  async (span: Span, deploymentVersion: schema.DeploymentVersion, db?: Tx) => {
    span.setAttribute("deploymentVersion.id", deploymentVersion.id);
    span.setAttribute("deploymentVersion.name", deploymentVersion.name);
    span.setAttribute("deployment.id", deploymentVersion.deploymentId);

    const tx = db ?? dbClient;
    const workspaceId = await getWorkspaceId(tx, deploymentVersion.id);
    span.setAttribute("workspace.id", workspaceId);

    const eventType = Event.DeploymentVersionDeleted;
    await sendNodeEvent(
      convertVersionToNodeEvent(deploymentVersion, workspaceId, eventType),
    );
    await sendGoEvent(
      convertVersionToGoEvent(
        deploymentVersion,
        workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);
