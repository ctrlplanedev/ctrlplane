import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { createSpanWrapper } from "../../span.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const getWorkspaceIdForDeployment = async (deploymentId: string) =>
  db
    .select()
    .from(schema.deployment)
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .where(eq(schema.deployment.id, deploymentId))
    .then(takeFirst)
    .then((row) => row.system.workspaceId);

const getWorkspaceIdForVariable = async (variableId: string) =>
  db
    .select()
    .from(schema.deploymentVariable)
    .innerJoin(
      schema.deployment,
      eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
    )
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .where(eq(schema.deploymentVariable.id, variableId))
    .then(takeFirst)
    .then((row) => row.system.workspaceId);

const convertDeploymentVariableToNodeEvent = (
  deploymentVariable: schema.DeploymentVariable,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.DeploymentVariableCreated,
  eventId: deploymentVariable.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: deploymentVariable,
});

const getDbDefaultValue = (defaultValueId: string) =>
  db
    .select()
    .from(schema.deploymentVariableValue)
    .leftJoin(
      schema.deploymentVariableValueDirect,
      eq(
        schema.deploymentVariableValueDirect.variableValueId,
        schema.deploymentVariableValue.id,
      ),
    )
    .where(eq(schema.deploymentVariableValue.id, defaultValueId))
    .then(takeFirstOrNull);

const getDefaultValue = async (
  variable: schema.DeploymentVariable,
): Promise<WorkspaceEngine["schemas"]["LiteralValue"] | undefined> => {
  const { defaultValueId } = variable;
  if (defaultValueId == null) return undefined;

  const dbResult = await getDbDefaultValue(defaultValueId);
  if (dbResult == null) return undefined;

  const { deployment_variable_value_direct: directValue } = dbResult;
  if (directValue == null) return undefined;

  const { value } = directValue;
  if (value == null) return undefined;

  if (typeof value === "object")
    return { object: value as Record<string, unknown> };

  return value;
};

const getOapiDeploymentVariable = async (
  deploymentVariable: schema.DeploymentVariable,
): Promise<WorkspaceEngine["schemas"]["DeploymentVariable"]> => ({
  id: deploymentVariable.id,
  key: deploymentVariable.key,
  description: deploymentVariable.description,
  deploymentId: deploymentVariable.deploymentId,
  defaultValue: await getDefaultValue(deploymentVariable),
});

const convertDeploymentVariableToGoEvent = async (
  deploymentVariable: schema.DeploymentVariable,
  workspaceId: string,
) => ({
  workspaceId,
  eventType: Event.DeploymentVariableCreated as const,
  data: await getOapiDeploymentVariable(deploymentVariable),
  timestamp: Date.now(),
});

export const dispatchDeploymentVariableCreated = createSpanWrapper(
  "dispatchDeploymentVariableCreated",
  async (span: Span, deploymentVariable: schema.DeploymentVariable) => {
    span.setAttribute("deploymentVariable.id", deploymentVariable.id);
    span.setAttribute("deploymentVariable.key", deploymentVariable.key);
    span.setAttribute("deployment.id", deploymentVariable.deploymentId);

    const workspaceId = await getWorkspaceIdForDeployment(
      deploymentVariable.deploymentId,
    );
    span.setAttribute("workspace.id", workspaceId);

    const nodeEvent = convertDeploymentVariableToNodeEvent(
      deploymentVariable,
      workspaceId,
    );
    const goEvent = await convertDeploymentVariableToGoEvent(
      deploymentVariable,
      workspaceId,
    );
    await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
  },
);

export const dispatchDeploymentVariableUpdated = createSpanWrapper(
  "dispatchDeploymentVariableUpdated",
  async (
    span: Span,
    previous: schema.DeploymentVariable,
    current: schema.DeploymentVariable,
  ) => {
    span.setAttribute("deploymentVariable.id", current.id);
    span.setAttribute("deploymentVariable.key", current.key);
    span.setAttribute("deployment.id", current.deploymentId);

    const workspaceId = await getWorkspaceIdForDeployment(current.deploymentId);
    span.setAttribute("workspace.id", workspaceId);

    const nodeEvent = {
      workspaceId,
      eventType: Event.DeploymentVariableUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api" as const,
      payload: { previous, current },
    };

    const goEvent = await convertDeploymentVariableToGoEvent(
      current,
      workspaceId,
    );
    await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
  },
);

export const dispatchDeploymentVariableDeleted = createSpanWrapper(
  "dispatchDeploymentVariableDeleted",
  async (span: Span, deploymentVariable: schema.DeploymentVariable) => {
    span.setAttribute("deploymentVariable.id", deploymentVariable.id);
    span.setAttribute("deploymentVariable.key", deploymentVariable.key);
    span.setAttribute("deployment.id", deploymentVariable.deploymentId);

    const workspaceId = await getWorkspaceIdForDeployment(
      deploymentVariable.deploymentId,
    );
    span.setAttribute("workspace.id", workspaceId);

    const nodeEvent = convertDeploymentVariableToNodeEvent(
      deploymentVariable,
      workspaceId,
    );
    const goEvent = await convertDeploymentVariableToGoEvent(
      deploymentVariable,
      workspaceId,
    );
    await Promise.all([sendNodeEvent(nodeEvent), sendGoEvent(goEvent)]);
  },
);

export const dispatchDeploymentVariableValueCreated = async (
  deploymentVariableValue: schema.DeploymentVariableValue,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForVariable(
    deploymentVariableValue.variableId,
  );
  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueCreated,
    eventId: deploymentVariableValue.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deploymentVariableValue,
  });
};

export const dispatchDeploymentVariableValueUpdated = async (
  previous: schema.DeploymentVariableValue,
  current: schema.DeploymentVariableValue,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForVariable(current.variableId);
  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
};

export const dispatchDeploymentVariableValueDeleted = async (
  deploymentVariableValue: schema.DeploymentVariableValue,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForVariable(
    deploymentVariableValue.variableId,
  );
  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueDeleted,
    eventId: deploymentVariableValue.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deploymentVariableValue,
  });
};
