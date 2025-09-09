import type { EventPayload, Message } from "@ctrlplane/events";
import type { KafkaMessage } from "kafkajs";

import { Event } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

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
import { deletedResource, newResource, updatedResource } from "./resources.js";

const handlers: Record<Event, Handler<any>> = {
  [Event.ResourceCreated]: newResource,
  [Event.ResourceUpdated]: updatedResource,
  [Event.ResourceDeleted]: deletedResource,
  [Event.EnvironmentCreated]: newEnvironment,
  [Event.EnvironmentUpdated]: updatedEnvironment,
  [Event.EnvironmentDeleted]: deletedEnvironment,
  [Event.DeploymentCreated]: newDeployment,
  [Event.DeploymentUpdated]: updatedDeployment,
  [Event.DeploymentDeleted]: deletedDeployment,
  [Event.DeploymentVersionCreated]: newDeploymentVersion,
  [Event.DeploymentVersionUpdated]: updatedDeploymentVersion,
  [Event.DeploymentVersionDeleted]: deletedDeploymentVersion,
  [Event.PolicyCreated]: newPolicy,
  [Event.PolicyUpdated]: updatedPolicy,
  [Event.PolicyDeleted]: deletedPolicy,
  [Event.JobUpdated]: updateJob,
};

export type Handler<T extends keyof EventPayload> = (
  event: Message<T>,
) => Promise<void> | void;

export const getHandler = <T extends keyof EventPayload = any>(
  event: T,
): Handler<T> => {
  return handlers[event];
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
