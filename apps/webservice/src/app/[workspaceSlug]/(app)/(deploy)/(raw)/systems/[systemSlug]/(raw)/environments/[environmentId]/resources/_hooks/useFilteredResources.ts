"use client";

import type { ResourceCondition } from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";

/**
 * Hook for fetching resources based on a filter condition
 *
 * @param workspaceId - ID of the workspace to fetch resources from
 * @param filter - Optional resource filter condition
 * @returns Query result containing filtered resources
 */
export const useFilteredResources = (
  workspaceId: string,
  environmentId: string,
  filter?: ResourceCondition | null,
  limit?: number,
  offset?: number,
) => {
  const resourcesQ = api.environment.page.resources.list.useQuery(
    { environmentId, workspaceId, filter: filter ?? undefined, limit, offset },
    { enabled: environmentId !== "" },
  );
  return { ...resourcesQ, resources: resourcesQ.data ?? [] };
};
