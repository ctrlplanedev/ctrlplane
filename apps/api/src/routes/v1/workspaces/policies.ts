import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const listPolicies: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/policies",
    { params: { path: { workspaceId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Failed to list policies",
      response.response.status,
    );

  res.status(200).json({ items: response.data.policies ?? [] });
  return;
};

const deletePolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies/{policyId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, policyId } = req.params;
  const client = getClientFor(workspaceId);
  const policy = await client.GET(
    "/v1/workspaces/{workspaceId}/policies/{policyId}",
    { params: { path: { workspaceId, policyId } } },
  );

  if (policy.error != null)
    throw new ApiError(
      policy.error.error ?? "Policy not found",
      policy.response.status,
    );

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.PolicyDeleted,
      timestamp: Date.now(),
      data: policy.data,
    });
  } catch {
    throw new ApiError("Failed to delete policy", 500);
  }
  res.status(202).json(policy.data);
};

const upsertPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies/{policyId}",
  "put"
> = async (req, res) => {
  const { workspaceId, policyId } = req.params;
  const { body } = req;
  const client = getClientFor(workspaceId);

  // Check if policy already exists
  const existingPolicy = await client.GET(
    "/v1/workspaces/{workspaceId}/policies/{policyId}",
    { params: { path: { workspaceId, policyId } } },
  );

  const policyIdResult = z.string().uuid().safeParse(policyId);
  if (!policyIdResult.success)
    throw new ApiError("Invalid policy ID: must be a valid UUID v4", 400);

  const createdAt = existingPolicy.data?.createdAt ?? new Date().toISOString();

  const policy: WorkspaceEngine["schemas"]["Policy"] = {
    id: policyId,
    workspaceId,
    createdAt,
    name: body.name,
    description: body.description,
    priority: body.priority,
    enabled: body.enabled,
    metadata: body.metadata,
    rules: body.rules.map((rule) => ({
      ...rule,
      id: uuidv4(),
      policyId,
      createdAt,
    })),
    selector: body.selector,
  };

  // Determine if this is a create or update
  const isUpdate = existingPolicy.data != null;

  try {
    await sendGoEvent({
      workspaceId,
      eventType: isUpdate ? Event.PolicyUpdated : Event.PolicyCreated,
      timestamp: Date.now(),
      data: policy,
    });
  } catch {
    throw new ApiError("Failed to update policy", 500);
  }

  res.status(202).json(policy);
};

const getPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies/{policyId}",
  "get"
> = async (req, res) => {
  const { workspaceId, policyId } = req.params;
  const client = getClientFor(workspaceId);

  const response = await client.GET(
    "/v1/workspaces/{workspaceId}/policies/{policyId}",
    { params: { path: { workspaceId, policyId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Policy not found",
      response.response.status,
    );

  res.status(200).json(response.data);
  return;
};

const createPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const policyId = uuidv4();
  const createdAt = new Date().toISOString();

  const policy: WorkspaceEngine["schemas"]["Policy"] = {
    id: policyId,
    workspaceId,
    enabled: true,
    priority: 0,
    createdAt,
    metadata: {},
    selector: "true",
    ...body,
    rules: (body.rules ?? []).map((rule) => ({
      ...rule,
      id: uuidv4(),
      policyId,
      createdAt,
    })),
  };

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.PolicyCreated,
      timestamp: Date.now(),
      data: policy,
    });
  } catch {
    throw new ApiError("Failed to create policy", 500);
  }

  res.status(202).json(policy);
};

export const policiesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listPolicies))
  .post("/", asyncHandler(createPolicy))
  .get("/:policyId", asyncHandler(getPolicy))
  .delete("/:policyId", asyncHandler(deletePolicy))
  .put("/:policyId", asyncHandler(upsertPolicy));
