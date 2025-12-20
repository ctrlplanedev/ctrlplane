import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const createRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const relationshipRule: WorkspaceEngine["schemas"]["RelationshipRule"] = {
    id: uuidv4(),
    workspaceId,
    ...body,
  };

  await sendGoEvent({
    workspaceId,
    eventType: Event.RelationshipRuleCreated,
    timestamp: Date.now(),
    data: relationshipRule,
  });

  res.status(201).json(relationshipRule);
  return;
};

const getRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
  "get"
> = async (req, res) => {
  const { workspaceId, relationshipRuleId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
    { params: { path: { workspaceId, relationshipRuleId } } },
  );

  if (response.error != null)
    throw new ApiError(response.error.error ?? "Relationship rule not found", response.response.status);

  res.status(200).json(response.data);
};

const deleteRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, relationshipRuleId } = req.params;

  await sendGoEvent({
    workspaceId,
    eventType: Event.RelationshipRuleDeleted,
    timestamp: Date.now(),
    data: {
      id: relationshipRuleId,
      workspaceId,
      fromType: "deployment",
      matcher: { cel: "" },
      metadata: {},
      name: "",
      reference: "",
      relationshipType: "",
      toType: "deployment",
    },
  });

  res.status(202).json({ id: relationshipRuleId });
};

const upsertRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
  "put"
> = async (req, res) => {
  const { workspaceId, relationshipRuleId } = req.params;
  const { body } = req;

  const relationshipRule: WorkspaceEngine["schemas"]["RelationshipRule"] = {
    id: relationshipRuleId,
    workspaceId,
    ...body,
  };

  await sendGoEvent({
    workspaceId,
    eventType: Event.RelationshipRuleUpdated,
    timestamp: Date.now(),
    data: relationshipRule,
  });

  res.status(202).json(relationshipRule);
  return;
};

export const relationshipRulesRouter = Router({ mergeParams: true })
  .post("/", asyncHandler(createRelationshipRule))
  .get("/:relationshipRuleId", asyncHandler(getRelationshipRule))
  .put("/:relationshipRuleId", asyncHandler(upsertRelationshipRule))
  .delete("/:relationshipRuleId", asyncHandler(deleteRelationshipRule));
