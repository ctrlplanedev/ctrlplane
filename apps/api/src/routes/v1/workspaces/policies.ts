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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.status(200).json(response.data?.policies ?? []);
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
  res.status(202).json(policy.data);
  return;
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

  // Generate IDs for nested objects if not provided
  const bodyRules = Array.isArray(body.rules) ? body.rules : [];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const rules: WorkspaceEngine["schemas"]["PolicyRule"][] = bodyRules.map(
    (rule) => ({
      ...rule,
      id: uuidv4(),
      policyId,
      createdAt: new Date().toISOString(),
    }),
  );

  const bodySelectors = Array.isArray(body.selectors) ? body.selectors : [];
  const selectors: WorkspaceEngine["schemas"]["PolicyTargetSelector"][] =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    bodySelectors.map((selector) => ({
      ...selector,
      id: uuidv4(),
    }));

  const policyIdResult = z.string().uuid().safeParse(policyId);
  if (!policyIdResult.success)
    throw new ApiError("Invalid policy ID: must be a valid UUID v4", 400);

  // Build the complete policy object
  const policy: WorkspaceEngine["schemas"]["Policy"] = {
    id: policyId,
    workspaceId,
    createdAt: existingPolicy.data?.createdAt ?? new Date().toISOString(),
    name: body.name,
    description: body.description,
    priority: body.priority ?? 0,
    enabled: body.enabled ?? true,
    metadata: body.metadata ?? {},
    rules,
    selectors,
  };

  // Determine if this is a create or update
  const isUpdate = existingPolicy.data != null;

  await sendGoEvent({
    workspaceId,
    eventType: isUpdate ? Event.PolicyUpdated : Event.PolicyCreated,
    timestamp: Date.now(),
    data: policy,
  });

  res.status(202).json(policy);
  return;
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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) throw new ApiError("Policy not found", 404);

  res.status(200).json(response.data);
  return;
};

export const policiesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listPolicies))
  .get("/:policyId", asyncHandler(getPolicy))
  .delete("/:policyId", asyncHandler(deletePolicy))
  .put("/:policyId", asyncHandler(upsertPolicy));
