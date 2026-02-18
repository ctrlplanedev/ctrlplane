import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

export const getSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "get"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;

  // This is a placeholder for your system retrieval logic
  // Replace the following line with your system-fetching logic, e.g. database query
  const system = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}",
    {
      params: {
        path: { workspaceId, systemId },
      },
    },
  );

  if (system.error != null)
    throw new ApiError(
      system.error.error ?? "System not found",
      system.response.status,
    );

  res.status(200).json(system.data.system);
};

export const upsertSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "put"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;
  const { name, description, metadata } = req.body;
  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemUpdated,
      timestamp: Date.now(),
      data: {
        id: systemId,
        name,
        description,
        metadata: metadata ?? {},
        workspaceId,
      },
    });

    res.status(202).json({ id: systemId, message: "System update requested" });
  } catch {
    throw new ApiError("Failed to update system", 500);
  }
};

export const deleteSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;

  const systemResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}",
    { params: { path: { workspaceId, systemId } } },
  );

  if (systemResponse.error != null)
    throw new ApiError(
      systemResponse.error.error ?? "System not found",
      systemResponse.response.status,
    );

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemDeleted,
      timestamp: Date.now(),
      data: systemResponse.data.system,
    });
  } catch {
    throw new ApiError("Failed to send delete request", 500);
  }

  res.status(202).json({ id: systemId, message: "System delete requested" });
};

export const getSystems: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;
  const systems = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (systems.error != null)
    throw new ApiError(
      systems.error.error ?? "Internal server error",
      systems.response.status,
    );

  res.status(200).json(systems.data);
};

export const createSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;

  try {
    const id = uuidv4();
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemCreated,
      timestamp: Date.now(),
      data: { id, workspaceId, metadata: {}, ...req.body },
    });
    res.status(202).json({ id, message: "System creation requested" });
  } catch {
    throw new ApiError("Failed to create system", 500);
  }
};

export const getDeploymentSystemLink: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, systemId, deploymentId } = req.params;
  const deploymentSystemLink = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, systemId, deploymentId } } },
  );
  if (deploymentSystemLink.error != null)
    throw new ApiError(
      deploymentSystemLink.error.error ?? "Deployment system link not found",
      deploymentSystemLink.response.status,
    );
  res.status(200).json(deploymentSystemLink.data);
};

export const getEnvironmentSystemLink: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, systemId, environmentId } = req.params;
  const environmentSystemLink = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
    { params: { path: { workspaceId, systemId, environmentId } } },
  );
  if (environmentSystemLink.error != null)
    throw new ApiError(
      environmentSystemLink.error.error ?? "Environment system link not found",
      environmentSystemLink.response.status,
    );
  res.status(200).json(environmentSystemLink.data);
};

export const linkDeploymentToSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, systemId, deploymentId } = req.params;
  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemDeploymentLinked,
      timestamp: Date.now(),
      data: { systemId, deploymentId },
    });
    res
      .status(202)
      .json({ id: systemId, message: "Deployment link requested" });
  } catch {
    throw new ApiError("Failed to link deployment to system", 500);
  }
};

export const unlinkDeploymentFromSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, systemId, deploymentId } = req.params;
  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemDeploymentUnlinked,
      timestamp: Date.now(),
      data: { systemId, deploymentId },
    });
    res
      .status(202)
      .json({ id: systemId, message: "Deployment unlink requested" });
  } catch {
    throw new ApiError("Failed to unlink deployment from system", 500);
  }
};

export const linkEnvironmentToSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, systemId, environmentId } = req.params;
  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemEnvironmentLinked,
      timestamp: Date.now(),
      data: { systemId, environmentId },
    });
    res
      .status(202)
      .json({ id: systemId, message: "Environment link requested" });
  } catch {
    throw new ApiError("Failed to link environment to system", 500);
  }
};

export const unlinkEnvironmentFromSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}/environments/{environmentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, systemId, environmentId } = req.params;
  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemEnvironmentUnlinked,
      timestamp: Date.now(),
      data: { systemId, environmentId },
    });
    res
      .status(202)
      .json({ id: systemId, message: "Environment unlink requested" });
  } catch {
    throw new ApiError("Failed to unlink environment from system", 500);
  }
};

export const systemRouter = Router({ mergeParams: true })
  .post("/", asyncHandler(createSystem))
  .get("/", asyncHandler(getSystems))
  .get("/:systemId", asyncHandler(getSystem))
  .delete("/:systemId", asyncHandler(deleteSystem))
  .put("/:systemId", asyncHandler(upsertSystem))
  .get(
    "/:systemId/deployments/:deploymentId",
    asyncHandler(getDeploymentSystemLink),
  )
  .put(
    "/:systemId/deployments/:deploymentId",
    asyncHandler(linkDeploymentToSystem),
  )
  .delete(
    "/:systemId/deployments/:deploymentId",
    asyncHandler(unlinkDeploymentFromSystem),
  )
  .get(
    "/:systemId/environments/:environmentId",
    asyncHandler(getEnvironmentSystemLink),
  )
  .put(
    "/:systemId/environments/:environmentId",
    asyncHandler(linkEnvironmentToSystem),
  )
  .delete(
    "/:systemId/environments/:environmentId",
    asyncHandler(unlinkEnvironmentFromSystem),
  );
