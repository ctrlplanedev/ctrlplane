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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.json(response.data);
};

const getExistingEnvironmentById = async (
  workspaceId: string,
  environmentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/environments/{environmentId}",
    { params: { path: { workspaceId, environmentId } } },
  );
  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) return null;

  return response.data;
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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) throw new ApiError("Environment not found", 404);

  res.json(response.data);
  return;
};

const deleteEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;

  await sendGoEvent({
    workspaceId,
    eventType: Event.EnvironmentDeleted,
    timestamp: Date.now(),
    data: {
      id: environmentId,
      name: "",
      systemId: "",
      createdAt: "",
    },
  });

  res.status(204).json({ message: "Environment deleted successfully" });
  return;
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

  await sendGoEvent({
    workspaceId,
    eventType: Event.EnvironmentCreated,
    timestamp: Date.now(),
    data: environment,
  });

  res.status(202).json(environment);
  return;
};

export const upsertEnvironmentById: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments/{environmentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, environmentId } = req.params;
  const { body } = req;

  const existingEnvironment = await getExistingEnvironmentById(
    workspaceId,
    environmentId,
  );

  if (existingEnvironment == null)
    throw new ApiError("Environment not found", 404);

  const mergedEnvironment = {
    ...existingEnvironment,
    ...body,
    id: existingEnvironment.id,
  };

  const isValid = await validResourceSelector(body.resourceSelector);

  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  await sendGoEvent({
    workspaceId,
    eventType: Event.EnvironmentUpdated,
    timestamp: Date.now(),
    data: mergedEnvironment,
  });

  res.status(200).json(mergedEnvironment);
  return;
};

export const environmentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listEnvironments))
  .post("/", asyncHandler(createEnvironment))
  .get("/:environmentId", asyncHandler(getEnvironment))
  .put("/:environmentId", asyncHandler(upsertEnvironmentById))
  .delete("/:environmentId", asyncHandler(deleteEnvironment));
