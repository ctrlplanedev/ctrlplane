import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

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

const getExistingEnvironment = async (
  workspaceId: string,
  systemId: string,
  name: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}",
    { params: { path: { workspaceId, systemId } } },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) return null;

  const { environments } = response.data;

  return environments.find((env) => env.name === name) ?? null;
};

const putEnvironment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/environments",
  "put"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const existingEnvironment = await getExistingEnvironment(
    workspaceId,
    body.systemId,
    body.name,
  );

  const environment: WorkspaceEngine["schemas"]["Environment"] = {
    id: uuidv4(),
    name: body.name,
    description: body.description,
    systemId: body.systemId,
    resourceSelector: body.resourceSelector,
    createdAt: new Date().toISOString(),
  };

  if (existingEnvironment != null) {
    const mergedEnvironment = {
      ...existingEnvironment,
      ...environment,
      id: existingEnvironment.id,
    };
    sendGoEvent({
      workspaceId,
      eventType: Event.EnvironmentUpdated,
      timestamp: Date.now(),
      data: mergedEnvironment,
    });
    res.json(mergedEnvironment);
    return;
  }

  sendGoEvent({
    workspaceId,
    eventType: Event.EnvironmentCreated,
    timestamp: Date.now(),
    data: environment,
  });
  res.status(201).json(environment);
  return;
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

export const environmentIdRouter = Router({ mergeParams: true }).get(
  "/",
  asyncHandler(getEnvironment),
);

export const environmentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listEnvironments))
  .put("/", asyncHandler(putEnvironment))
  .use("/:environmentId", environmentIdRouter);
