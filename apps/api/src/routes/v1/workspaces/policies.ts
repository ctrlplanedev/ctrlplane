import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { wsEngine } from "@/engine.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";

const listPolicies: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const response = await wsEngine.GET("/v1/workspaces/{workspaceId}/policies", {
    params: { path: { workspaceId } },
  });

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.status(200).json(response.data?.policies ?? []);
  return;
};

const getExistingPolicy = async (workspaceId: string, name: string) => {
  const response = await wsEngine.GET("/v1/workspaces/{workspaceId}/policies", {
    params: { path: { workspaceId } },
  });

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

export const policiesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listPolicies))
  .put("/", asyncHandler(upsertPolicy));
