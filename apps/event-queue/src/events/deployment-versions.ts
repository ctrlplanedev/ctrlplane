import type * as schema from "@ctrlplane/db/schema";
import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const getDeploymentVersionWithDates = (
  deploymentVersion: schema.DeploymentVersion,
) => {
  const createdAt = new Date(deploymentVersion.createdAt);
  return { ...deploymentVersion, createdAt };
};

export const newDeploymentVersion: Handler<
  Event.DeploymentVersionCreated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const deploymentVersion = getDeploymentVersionWithDates(event.payload);
  await OperationPipeline.update(ws)
    .deploymentVersion(deploymentVersion)
    .dispatch();
};

export const updatedDeploymentVersion: Handler<
  Event.DeploymentVersionUpdated
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const deploymentVersion = getDeploymentVersionWithDates(
    event.payload.current,
  );
  await OperationPipeline.update(ws)
    .deploymentVersion(deploymentVersion)
    .dispatch();
};

export const deletedDeploymentVersion: Handler<
  Event.DeploymentVersionDeleted
> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const deploymentVersion = getDeploymentVersionWithDates(event.payload);
  await OperationPipeline.delete(ws)
    .deploymentVersion(deploymentVersion)
    .dispatch();
};
