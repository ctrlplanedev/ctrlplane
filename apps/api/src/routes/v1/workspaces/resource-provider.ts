import type { AsyncTypedHandler } from "@/types/api.js";

import { Event, sendGoEvent } from "@ctrlplane/events";

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
