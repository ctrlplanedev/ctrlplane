import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { sendNodeEvent } from "../client.js";
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

export const dispatchDeploymentVariableCreated = async (
  deploymentVariable: schema.DeploymentVariable,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForDeployment(
    deploymentVariable.deploymentId,
  );
  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVariableCreated,
    eventId: deploymentVariable.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deploymentVariable,
  });
};

export const dispatchDeploymentVariableUpdated = async (
  previous: schema.DeploymentVariable,
  current: schema.DeploymentVariable,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForDeployment(current.deploymentId);
  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVariableUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: { previous, current },
  });
};

export const dispatchDeploymentVariableDeleted = async (
  deploymentVariable: schema.DeploymentVariable,
  source?: "api" | "scheduler" | "user-action",
) => {
  const workspaceId = await getWorkspaceIdForDeployment(
    deploymentVariable.deploymentId,
  );
  await sendNodeEvent({
    workspaceId,
    eventType: Event.DeploymentVariableDeleted,
    eventId: deploymentVariable.id,
    timestamp: Date.now(),
    source: source ?? "api",
    payload: deploymentVariable,
  });
};

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
