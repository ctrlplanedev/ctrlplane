import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";

const listEnvironments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Failed to list environments",
      response.response.status,
    );

  res.status(200).json(response.data);
};

const getEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}",
    { params: { path: { workspaceId, environmentId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Environment not found",
      response.response.status,
    );

  res.status(200).json(response.data);
};

const deleteEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;

  const environmentResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}",
    { params: { path: { workspaceId, environmentId } } },
  );

  if (environmentResponse.error != null)
    throw new ApiError(
      environmentResponse.error.error ?? "Environment not found",
      environmentResponse.response.status,
    );

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.EnvironmentDeleted,
      timestamp: Date.now(),
      data: environmentResponse.data,
    });
  } catch {
    throw new ApiError("Failed to delete environment", 500);
  }

  res
    .status(202)
    .json({ id: environmentId, message: "Environment delete requested" });
};

const createEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const environment: WorkspaceEngine["schemas"]["Environment"] = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...body,
  };

  const isValid = await validResourceSelector(body.resourceSelector);

  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.EnvironmentCreated,
      timestamp: Date.now(),
      data: environment,
    });
  } catch {
    throw new ApiError("Failed to create environment", 500);
  }

  res
    .status(202)
    .json({ id: environment.id, message: "Environment creation requested" });
};

export const upsertEnvironmentById: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;
  const { body } = req;

  const mergedEnvironment = {
    id: environmentId,
    createdAt: new Date().toISOString(),
    ...body,
  };

  const isValid = await validResourceSelector(body.resourceSelector);

  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.EnvironmentUpdated,
      timestamp: Date.now(),
      data: mergedEnvironment,
    });
  } catch {
    throw new ApiError("Failed to update environment", 500);
  }

  res
    .status(202)
    .json({ id: environmentId, message: "Environment update requested" });
};

export const environmentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listEnvironments))
  .post("/", asyncHandler(createEnvironment))
  .get("/:environmentId", asyncHandler(getEnvironment))
  .put("/:environmentId", asyncHandler(upsertEnvironmentById))
  .delete("/:environmentId", asyncHandler(deleteEnvironment));
