import type { Tx } from "@ctrlplane/db";
import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type {
  EventPayload,
  GoEventPayload,
  GoMessage,
  Message,
} from "../events.js";
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

const convertDeploymentToNodeEvent = <T extends keyof EventPayload>(
  deployment: schema.Deployment,
  workspaceId: string,
  eventType: T,
): Message<T> => ({
  workspaceId,
  eventType,
  eventId: deployment.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: deployment as EventPayload[T],
});

const getOapiDeployment = (
  deployment: schema.Deployment,
): WorkspaceEngine["schemas"]["Deployment"] => ({
  id: deployment.id,
  name: deployment.name,
  slug: deployment.slug,
  description: deployment.description,
  systemId: deployment.systemId,
  jobAgentId: deployment.jobAgentId ?? undefined,
  jobAgentConfig: deployment.jobAgentConfig,
  resourceSelector: convertToOapiSelector(deployment.resourceSelector),
});

const convertDeploymentToGoEvent = (
  deployment: schema.Deployment,
  workspaceId: string,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId,
  eventType,
  data: getOapiDeployment(deployment),
  timestamp: Date.now(),
});

export const dispatchDeploymentCreated = createSpanWrapper(
  "dispatchDeploymentCreated",
  async (span: Span, deployment: schema.Deployment, db?: Tx) => {
    span.setAttribute("deployment.id", deployment.id);
    span.setAttribute("deployment.name", deployment.name);
    span.setAttribute("system.id", deployment.systemId);

    const tx = db ?? dbClient;
    const system = await getSystem(tx, deployment.systemId);
    span.setAttribute("workspace.id", system.workspaceId);

    const eventType = Event.DeploymentCreated;
    await sendNodeEvent(
      convertDeploymentToNodeEvent(deployment, system.workspaceId, eventType),
    );
    await sendGoEvent(
      convertDeploymentToGoEvent(
        deployment,
        system.workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchDeploymentUpdated = createSpanWrapper(
  "dispatchDeploymentUpdated",
  async (
    span: Span,
    previous: schema.Deployment,
    current: schema.Deployment,
    db?: Tx,
  ) => {
    span.setAttribute("deployment.id", current.id);
    span.setAttribute("deployment.name", current.name);
    span.setAttribute("system.id", current.systemId);

    const tx = db ?? dbClient;
    const system = await getSystem(tx, current.systemId);
    span.setAttribute("workspace.id", system.workspaceId);

    const eventType = Event.DeploymentUpdated;
    await sendNodeEvent({
      workspaceId: system.workspaceId,
      eventType,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api" as const,
      payload: { previous, current },
    });
    await sendGoEvent(
      convertDeploymentToGoEvent(
        current,
        system.workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);

export const dispatchDeploymentDeleted = createSpanWrapper(
  "dispatchDeploymentDeleted",
  async (span: Span, deployment: schema.Deployment, db?: Tx) => {
    span.setAttribute("deployment.id", deployment.id);
    span.setAttribute("deployment.name", deployment.name);
    span.setAttribute("system.id", deployment.systemId);

    const tx = db ?? dbClient;
    const system = await getSystem(tx, deployment.systemId);
    span.setAttribute("workspace.id", system.workspaceId);

    const eventType = Event.DeploymentDeleted;
    await sendNodeEvent(
      convertDeploymentToNodeEvent(deployment, system.workspaceId, eventType),
    );
    await sendGoEvent(
      convertDeploymentToGoEvent(
        deployment,
        system.workspaceId,
        eventType as keyof GoEventPayload,
      ),
    );
  },
);
