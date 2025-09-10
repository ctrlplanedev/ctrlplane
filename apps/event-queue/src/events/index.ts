import type { EventPayload, Message } from "@ctrlplane/events";
import type { KafkaMessage } from "kafkajs";

import { Event } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

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
import { evaluateReleaseTargets } from "./release-targets.js";
import {
  deletedResource,
  deletedResourceVariable,
  newResource,
  newResourceVariable,
  updatedResource,
  updatedResourceVariable,
} from "./resources.js";

const handlers: Record<Event, Handler<any>> = {
  [Event.ResourceCreated]: newResource,
  [Event.ResourceUpdated]: updatedResource,
  [Event.ResourceDeleted]: deletedResource,
  [Event.ResourceVariableCreated]: newResourceVariable,
  [Event.ResourceVariableUpdated]: updatedResourceVariable,
  [Event.ResourceVariableDeleted]: deletedResourceVariable,
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
  [Event.EvaluateReleaseTargets]: evaluateReleaseTargets,
};

export type Handler<T extends keyof EventPayload> = (
  event: Message<T>,
) => Promise<void> | void;

export const getHandler = (eventType: string): Handler<any> | null => {
  const eventKey = Object.keys(Event).find(
    (key) => String(Event[key as keyof typeof Event]) === eventType,
  );
  if (eventKey == null) {
    logger.error("No handler found for event type", { eventType });
    return null;
  }

  return handlers[eventType as keyof typeof handlers];
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
