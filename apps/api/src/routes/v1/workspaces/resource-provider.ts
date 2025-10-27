import type { AsyncTypedHandler } from "@/types/api.js";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

export const setResourceProviderResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
  "put"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;
  const { resources } = req.body;

  await sendGoEvent({
    workspaceId,
    eventType: Event.ResourceProviderSetResources,
    timestamp: Date.now(),
    data: {
      providerId,
      resources: resources.map((r) => ({
        id: "",
        ...r,
        workspaceId,
      })),
    },
  });

  res.status(202).json({ ok: true });
};

export const getResourceProviderByName: AsyncTypedHandler<
  "/api/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
  "get"
> = async (req, res) => {
  const { workspaceId, name } = req.params;

  const resourceProvider = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
    { params: { path: { workspaceId, name } } },
  );

  if (resourceProvider.data == null) {
    res.status(404).json({ error: "Resource provider not found" });
    return;
  }

  res.status(200).json(resourceProvider.data);
};
