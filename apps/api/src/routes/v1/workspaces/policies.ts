import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const listPolicies: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/policies",
    {
      params: { path: { workspaceId } },
    },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.status(200).json(response.data?.policies ?? []);
  return;
};

const getExistingPolicy = async (workspaceId: string, name: string) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/policies",
    {
      params: { path: { workspaceId } },
    },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  return (
    response.data?.policies?.find((policy) => policy.name === name) ?? null
  );
};

const upsertPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "put"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const policy: WorkspaceEngine["schemas"]["Policy"] = {
    id: uuidv4(),
    description: body.description,
    enabled: body.enabled ?? true,
    metadata: body.metadata ?? {},
    name: body.name,
    priority: body.priority ?? 0,
    rules: body.rules ?? [],
    selectors: body.selectors ?? [],
    workspaceId,
    createdAt: new Date().toISOString(),
  };

  const existingPolicy = await getExistingPolicy(workspaceId, body.name);
  if (existingPolicy != null) {
    const mergedPolicy = {
      ...existingPolicy,
      ...policy,
      id: existingPolicy.id,
    };
    await sendGoEvent({
      workspaceId,
      eventType: Event.PolicyUpdated,
      timestamp: Date.now(),
      data: mergedPolicy,
    });
    res.status(200).json(mergedPolicy);
    return;
  }

  await sendGoEvent({
    workspaceId,
    eventType: Event.PolicyCreated,
    timestamp: Date.now(),
    data: policy,
  });
  res.status(201).json(policy);
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

  if (policy.error?.error != null) throw new ApiError(policy.error.error, 500);
  if (policy.data == null) throw new ApiError("Policy not found", 404);

  await sendGoEvent({
    workspaceId,
    eventType: Event.PolicyDeleted,
    timestamp: Date.now(),
    data: policy.data,
  });
  res.status(200).json(policy.data);
  return;
};

const policyIdRouter = Router({ mergeParams: true }).delete(
  "/",
  asyncHandler(deletePolicy),
);

export const policiesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listPolicies))
  .put("/", asyncHandler(upsertPolicy))
  .use("/:policyId", policyIdRouter);
