import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

export const newEnvironment: Handler<Event.EnvironmentCreated> = async (
  event,
  ws,
) => {
  const createdAt = new Date(event.payload.createdAt);
  const environment = { ...event.payload, createdAt };
  await OperationPipeline.update(ws).environment(environment).dispatch();
};

export const updatedEnvironment: Handler<Event.EnvironmentUpdated> = async (
  event,
  ws,
) => {
  const createdAt = new Date(event.payload.current.createdAt);
  const environment = { ...event.payload.current, createdAt };
  await OperationPipeline.update(ws).environment(environment).dispatch();
};

export const deletedEnvironment: Handler<Event.EnvironmentDeleted> = async (
  event,
  ws,
) => {
  await OperationPipeline.delete(ws).environment(event.payload).dispatch();
};
