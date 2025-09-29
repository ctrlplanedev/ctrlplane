import type * as schema from "@ctrlplane/db/schema";
import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

const getDeploymentVersionWithDates = (
  deploymentVersion: schema.DeploymentVersion,
) => {
  const createdAt = new Date(deploymentVersion.createdAt);
  return { ...deploymentVersion, createdAt };
};

export const newDeploymentVersion: Handler<
  Event.DeploymentVersionCreated
> = async (event, ws, span) => {
  span.setAttribute("deployment.id", event.payload.deploymentId);

  const deploymentVersion = getDeploymentVersionWithDates(event.payload);
  await OperationPipeline.update(ws)
    .deploymentVersion(deploymentVersion)
    .dispatch();
};

export const updatedDeploymentVersion: Handler<
  Event.DeploymentVersionUpdated
> = async (event, ws, span) => {
  span.setAttribute("deployment-version.id", event.payload.current.id);
  span.setAttribute("deployment.id", event.payload.current.deploymentId);

  const deploymentVersion = getDeploymentVersionWithDates(
    event.payload.current,
  );
  await OperationPipeline.update(ws)
    .deploymentVersion(deploymentVersion)
    .dispatch();
};

export const deletedDeploymentVersion: Handler<
  Event.DeploymentVersionDeleted
> = async (event, ws, span) => {
  span.setAttribute("deployment.id", event.payload.deploymentId);

  const deploymentVersion = getDeploymentVersionWithDates(event.payload);
  await OperationPipeline.delete(ws)
    .deploymentVersion(deploymentVersion)
    .dispatch();
};
