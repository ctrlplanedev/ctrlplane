import type { AsyncTypedHandler } from "@/types/api.js";

import { Event, sendGoEvent } from "@ctrlplane/events";

export const setResourceProviderResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
  "put"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;
  const { resources } = req.body;

  for (const resource of resources) {
    await sendGoEvent({
      workspaceId,
      eventType: Event.ResourceUpdated,
      timestamp: Date.now(),
      data: { id: "", ...resource, providerId, workspaceId },
    });
  }

  res.status(202).json({});
};
