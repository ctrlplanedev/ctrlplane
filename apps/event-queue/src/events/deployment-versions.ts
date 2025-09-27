import type * as schema from "@ctrlplane/db/schema";
import type { Event } from "@ctrlplane/events";

import { makeWithSpan, trace } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const newDeploymentVersionTracer = trace.getTracer("new-deployment-version");
const withNewDeploymentVersionSpan = makeWithSpan(newDeploymentVersionTracer);

const getDeploymentVersionWithDates = (
  deploymentVersion: schema.DeploymentVersion,
) => {
  const createdAt = new Date(deploymentVersion.createdAt);
  return { ...deploymentVersion, createdAt };
};

export const newDeploymentVersion: Handler<Event.DeploymentVersionCreated> =
  withNewDeploymentVersionSpan(
    "new-deployment-version",
    async (span, event) => {
      span.setAttribute("deployment-version.id", event.payload.id);
      span.setAttribute("deployment.id", event.payload.deploymentId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      const deploymentVersion = getDeploymentVersionWithDates(event.payload);
      await OperationPipeline.update(ws)
        .deploymentVersion(deploymentVersion)
        .dispatch();
    },
  );

const updatedDeploymentVersionTracer = trace.getTracer(
  "updated-deployment-version",
);
const withUpdatedDeploymentVersionSpan = makeWithSpan(
  updatedDeploymentVersionTracer,
);

export const updatedDeploymentVersion: Handler<Event.DeploymentVersionUpdated> =
  withUpdatedDeploymentVersionSpan(
    "updated-deployment-version",
    async (span, event) => {
      span.setAttribute("deployment-version.id", event.payload.current.id);
      span.setAttribute("deployment.id", event.payload.current.deploymentId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      const deploymentVersion = getDeploymentVersionWithDates(
        event.payload.current,
      );
      await OperationPipeline.update(ws)
        .deploymentVersion(deploymentVersion)
        .dispatch();
    },
  );

const deletedDeploymentVersionTracer = trace.getTracer(
  "deleted-deployment-version",
);
const withDeletedDeploymentVersionSpan = makeWithSpan(
  deletedDeploymentVersionTracer,
);

export const deletedDeploymentVersion: Handler<Event.DeploymentVersionDeleted> =
  withDeletedDeploymentVersionSpan(
    "deleted-deployment-version",
    async (span, event) => {
      span.setAttribute("deployment-version.id", event.payload.id);
      span.setAttribute("deployment.id", event.payload.deploymentId);
      span.setAttribute("workspace.id", event.workspaceId);
      const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
      if (ws == null) return;
      const deploymentVersion = getDeploymentVersionWithDates(event.payload);
      await OperationPipeline.delete(ws)
        .deploymentVersion(deploymentVersion)
        .dispatch();
    },
  );
