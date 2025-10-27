import type { AsyncTypedHandler } from "@/types/api.js";
import { asyncHandler } from "@/types/api.js";
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
        path: {
          workspaceId,
          systemId,
        },
      },
    },
  );

  if (!system.data) {
    res.status(404).json({ message: "System not found" });
    return;
  }

  res.status(200).json(system);
};

export const upsertSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "put"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;
  const { name, description } = req.body;
  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemUpdated,
      timestamp: Date.now(),
      data: { id: systemId, name, description, workspaceId },
    });

    res.status(200).json({ message: "System updated successfully" });
  } catch {
    res.status(500).json({ message: "Failed to update system" });
    return;
  }
};

export const deleteSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems/{systemId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, systemId } = req.params;

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemDeleted,
      timestamp: Date.now(),
      data: { id: systemId, name: "", workspaceId },
    });
  } catch {
    res.status(500).json({ message: "Failed to delete system" });
    return;
  }

  res.status(204).json({ message: "System deleted successfully" });
};

export const createSystem: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/systems",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { name, description } = req.body;

  try {
    const id = uuidv4();
    await sendGoEvent({
      workspaceId,
      eventType: Event.SystemCreated,
      timestamp: Date.now(),
      data: { id, name, description, workspaceId },
    });
    res.status(202).json({ id, workspaceId, ...req.body });
  } catch {
    res.status(500).json({ message: "Failed to create system" });
    return;
  }
};
export const systemRouter = Router({ mergeParams: true })
  .post("/", asyncHandler(createSystem))
  .get("/:systemId", asyncHandler(getSystem))
  .delete("/:systemId", asyncHandler(deleteSystem))
  .put("/:systemId", asyncHandler(upsertSystem));
