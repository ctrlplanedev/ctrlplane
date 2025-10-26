import type { EventPayload, Message } from "@ctrlplane/events";
import type { Span } from "@ctrlplane/logger";
import type { KafkaMessage } from "kafkajs";

import { Event } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import type { Workspace } from "../workspace/workspace.js";
import { createSpanWrapper } from "../traces.js";
import { WorkspaceManager } from "../workspace/workspace.js";
import {
  deletedDeploymentVariable,
  deletedDeploymentVariableValue,
  newDeploymentVariable,
  newDeploymentVariableValue,
  updatedDeploymentVariable,
  updatedDeploymentVariableValue,
} from "./deployment-variables.js";
import {
  deletedDeploymentVersion,
  newDeploymentVersion,
  updatedDeploymentVersion,
} from "./deployment-versions.js";
import {
  deletedDeployment,
  newDeployment,
  updatedDeployment,
} from "./deployments.js";
import {
  deletedEnvironment,
  newEnvironment,
  updatedEnvironment,
} from "./environments.js";
import { updateJob } from "./job.js";
import { deletedPolicy, newPolicy, updatedPolicy } from "./policy.js";
import { evaluateReleaseTarget } from "./release-targets.js";
import {
  deletedResource,
  deletedResourceVariable,
  newResource,
  newResourceVariable,
  updatedResource,
  updatedResourceVariable,
} from "./resources.js";

const workspaceHandlers: Record<Event, Handler<any>> = {
  [Event.WorkspaceSave]: () => Promise.resolve(),
  [Event.ResourceCreated]: newResource,
  [Event.ResourceUpdated]: updatedResource,
  [Event.ResourceDeleted]: deletedResource,
  [Event.ResourceVariableCreated]: newResourceVariable,
  [Event.ResourceVariableUpdated]: updatedResourceVariable,
  [Event.ResourceVariableDeleted]: deletedResourceVariable,
  [Event.ResourceProviderSetResources]: () => Promise.resolve(),
  [Event.EnvironmentCreated]: newEnvironment,
  [Event.EnvironmentUpdated]: updatedEnvironment,
  [Event.EnvironmentDeleted]: deletedEnvironment,
  [Event.DeploymentCreated]: newDeployment,
  [Event.DeploymentUpdated]: updatedDeployment,
  [Event.DeploymentDeleted]: deletedDeployment,
  [Event.DeploymentVariableCreated]: newDeploymentVariable,
  [Event.DeploymentVariableUpdated]: updatedDeploymentVariable,
  [Event.DeploymentVariableDeleted]: deletedDeploymentVariable,
  [Event.DeploymentVariableValueCreated]: newDeploymentVariableValue,
  [Event.DeploymentVariableValueUpdated]: updatedDeploymentVariableValue,
  [Event.DeploymentVariableValueDeleted]: deletedDeploymentVariableValue,
  [Event.DeploymentVersionCreated]: newDeploymentVersion,
  [Event.DeploymentVersionUpdated]: updatedDeploymentVersion,
  [Event.DeploymentVersionDeleted]: deletedDeploymentVersion,
  [Event.PolicyCreated]: newPolicy,
  [Event.PolicyUpdated]: updatedPolicy,
  [Event.PolicyDeleted]: deletedPolicy,
  [Event.JobUpdated]: updateJob,
  [Event.EvaluateReleaseTarget]: evaluateReleaseTarget,
  [Event.SystemCreated]: () => Promise.resolve(),
  [Event.SystemUpdated]: () => Promise.resolve(),
  [Event.SystemDeleted]: () => Promise.resolve(),
  [Event.UserApprovalRecordCreated]: () => Promise.resolve(),
  [Event.UserApprovalRecordUpdated]: () => Promise.resolve(),
  [Event.UserApprovalRecordDeleted]: () => Promise.resolve(),
  [Event.JobAgentCreated]: () => Promise.resolve(),
  [Event.JobAgentUpdated]: () => Promise.resolve(),
  [Event.JobAgentDeleted]: () => Promise.resolve(),
  [Event.GithubEntityCreated]: () => Promise.resolve(),
  [Event.GithubEntityUpdated]: () => Promise.resolve(),
  [Event.GithubEntityDeleted]: () => Promise.resolve(),
  [Event.Redeploy]: () => Promise.resolve(),
  [Event.RelationshipRuleCreated]: () => Promise.resolve(),
  [Event.RelationshipRuleUpdated]: () => Promise.resolve(),
  [Event.RelationshipRuleDeleted]: () => Promise.resolve(),
};

export type Handler<T extends keyof EventPayload> = (
  event: Message<T>,
  workspace: Workspace,
  span: Span,
) => Promise<void> | void;

export const getHandler = (eventType: string) => {
  const eventKey = Object.keys(Event).find(
    (key) => String(Event[key as keyof typeof Event]) === eventType,
  );
  if (eventKey == null) {
    logger.error("No handler found for event type", { eventType });
    return null;
  }

  const func = workspaceHandlers[eventType as keyof typeof workspaceHandlers];

  return createSpanWrapper(eventType, async (span, event) => {
    span.setAttribute("event.type", eventType);
    span.setAttribute("workspace.id", event.workspaceId);
    if ("id" in event.payload) span.setAttribute("event.id", event.payload.id);

    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;

    return func(event, ws, span);
  });
};

export const parseKafkaMessage = <T extends keyof EventPayload = any>(
  message: KafkaMessage,
) => {
  try {
    const { value } = message;
    if (value == null) return null;

    return JSON.parse(value.toString()) as Message<T>;
  } catch (error) {
    logger.error("Failed to parse Kafka message", { error });
    return null;
  }
};
