import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

export const newDeployment: Handler<Event.DeploymentCreated> = async (
  event,
  ws,
) => {
  await OperationPipeline.update(ws).deployment(event.payload).dispatch();
};

export const updatedDeployment: Handler<Event.DeploymentUpdated> = async (
  event,
  ws,
) => {
  await OperationPipeline.update(ws)
    .deployment(event.payload.current)
    .dispatch();
};

export const deletedDeployment: Handler<Event.DeploymentDeleted> = async (
  event,
  ws,
) => {
  await OperationPipeline.delete(ws).deployment(event.payload).dispatch();
};
