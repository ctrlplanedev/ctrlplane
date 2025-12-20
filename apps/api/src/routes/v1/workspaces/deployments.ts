import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import z from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";
import { deploymentVariablesRouter } from "./deployment-variables.js";

const listDeployments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (response.error != null)
    throw new ApiError(response.error.error ?? "Failed to list deployments", response.response.status);

  res.json(response.data);
};

const existingDeploymentById = async (
  workspaceId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );
  if (response.error != null) {
    if (response.response.status === 404) return null;
    throw new ApiError(response.error.error ?? "Failed to get deployment", response.response.status);
  }

  return response.data;
};

const ghSchema = z.object({
  workflowId: z.coerce.number(),
  ref: z.string().optional(),
  repo: z.string(),
});

const argoSchema = z.object({
  template: z.string(),
});

const tfeSchema = z.object({
  template: z.string(),
});

const customSchema = z.object({}).passthrough();

const getTypedDeploymentAgentConfig = (
  config: Record<string, any>,
): WorkspaceEngine["schemas"]["DeploymentJobAgentConfig"] => {
  const ghParseResult = ghSchema.safeParse(config);
  if (ghParseResult.success)
    return { ...ghParseResult.data, type: "github-app" };

  const argoParseResult = argoSchema.safeParse(config);
  if (argoParseResult.success)
    return { ...argoParseResult.data, type: "argo-cd" };

  const tfeParseResult = tfeSchema.safeParse(config);
  if (tfeParseResult.success) return { ...tfeParseResult.data, type: "tfe" };

  const customParseResult = customSchema.safeParse(config);
  if (customParseResult.success)
    return { ...customParseResult.data, type: "custom" };

  throw new ApiError("Invalid deployment agent config", 400);
};

const getDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );

  if (response.error != null)
    throw new ApiError(response.error.error ?? "Deployment not found", response.response.status);

  res.json(response.data);
};

const deleteDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentDeleted,
    timestamp: Date.now(),
    data: {
      id: deploymentId,
      name: "",
      systemId: "",
      slug: "",
      jobAgentConfig: { type: "custom" },
    },
  });

  res.status(204).json({ message: "Deployment deleted successfully" });
  return;
};

const postDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const deployment: WorkspaceEngine["schemas"]["Deployment"] = {
    id: uuidv4(),
    ...body,
    jobAgentConfig: getTypedDeploymentAgentConfig(body.jobAgentConfig ?? {}),
  };

  const isValid = await validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentCreated,
    timestamp: Date.now(),
    data: deployment,
  });

  res.status(202).json(deployment);

  return;
};

const upsertDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  console.log(body);

  const existingDeploymentResponse = await existingDeploymentById(
    workspaceId,
    deploymentId,
  );
  const { deployment } = existingDeploymentResponse ?? {};

  if (deployment == null) {
    await sendGoEvent({
      workspaceId,
      eventType: Event.DeploymentCreated,
      timestamp: Date.now(),
      data: {
        ...body,
        id: deploymentId,
        jobAgentConfig: getTypedDeploymentAgentConfig(
          body.jobAgentConfig ?? {},
        ),
      },
    });

    res.status(202).json({ id: deploymentId, ...body });
    return;
  }

  const isValid = await validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentUpdated,
    timestamp: Date.now(),
    data: {
      ...deployment,
      ...body,
      jobAgentConfig: getTypedDeploymentAgentConfig(body.jobAgentConfig ?? {}),
    },
  });

  res.status(202).json(deployment);
};

const listDeploymentVersions: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { limit, offset } = req.query;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
    {
      params: { path: { workspaceId, deploymentId }, query: { limit, offset } },
    },
  );

  if (response.error != null)
    throw new ApiError(response.error.error ?? "Failed to list deployment versions", response.response.status);

  res.json(response.data);
};

const createDeploymentVersion: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "post"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const data = {
    ...body,
    config: body.config ?? {},
    jobAgentConfig: body.jobAgentConfig ?? {},
    metadata: body.metadata ?? {},
    deploymentId,
    createdAt: new Date().toISOString(),
    id: uuidv4(),
  };

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVersionUpdated,
    timestamp: Date.now(),
    data,
  });

  res.status(200).json(data);
};

export const deploymentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeployments))
  .post("/", asyncHandler(postDeployment))
  .get("/:deploymentId", asyncHandler(getDeployment))
  .put("/:deploymentId", asyncHandler(upsertDeployment))
  .delete("/:deploymentId", asyncHandler(deleteDeployment))
  .get("/:deploymentId/versions", asyncHandler(listDeploymentVersions))
  .post("/:deploymentId/versions", asyncHandler(createDeploymentVersion))
  .use("/:deploymentId/variables", deploymentVariablesRouter);
