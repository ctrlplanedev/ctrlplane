import type { FC } from "react";
import type { Node } from "reactflow";
import React from "react";
import Link from "next/link";
import { IconAlertTriangle, IconCheck, IconLoader } from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";
import LZString from "lz-string";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";

type UniqueFilterResult = {
  overlaps: { nodeId: string; overlappingResourceCount: number }[];
} | null;

const useResourceFilterUniqueness = (
  nodes: Node[],
  workspaceId: string,
  currentNode: Node,
): UniqueFilterResult => {
  const utils = api.useUtils();
  const otherNodes = nodes.filter((node) => node.id !== currentNode.id);
  const overlappingQueries = useQueries({
    queries: otherNodes.map((node) => ({
      queryKey: [
        "resource",
        workspaceId,
        currentNode.data.resourceFilter,
        node.data.resourceFilter,
      ],
      queryFn: () =>
        utils.resource.byWorkspaceId.list
          .fetch({
            limit: 0,
            workspaceId,
            filter: {
              type: "comparison",
              operator: "and",
              conditions: [
                currentNode.data.resourceFilter,
                node.data.resourceFilter,
              ],
            },
          })
          .then((res) => res.total),
      enabled:
        currentNode.data.resourceFilter != null &&
        node.data.resourceFilter != null,
    })),
  });

  if (overlappingQueries.some((q) => q.isLoading || q.isError)) return null;
  if (otherNodes.length !== overlappingQueries.length) return null;

  const overlaps = overlappingQueries.reduce(
    (acc, query, index) => {
      const count = query.data ?? 0;
      if (count > 0)
        acc.push({
          nodeId: otherNodes[index]!.id,
          overlappingResourceCount: count,
        });
      return acc;
    },
    [] as { nodeId: string; overlappingResourceCount: number }[],
  );

  return { overlaps };
};

const StatusMap = {
  loading: {
    text: "Checking resource uniqueness...",
    icon: <IconLoader className="mr-1 h-4 w-4 animate-spin text-blue-500" />,
  },
  unique: {
    text: "All Environments have unique resources",
    icon: <IconCheck className="mr-1 h-4 w-4 text-green-400" />,
  },
  overlapping: {
    text: "Resources overlap Environments for this System",
    icon: <IconAlertTriangle className="mr-1 h-4 w-4 text-orange-400" />,
  },
};

export const ResourceFilterUniquenessIndicator: FC<{
  nodes: Node[];
  workspaceId: string;
  workspaceSlug: string;
  currentNode: Node;
}> = ({ nodes, workspaceId, workspaceSlug, currentNode }) => {
  const result = useResourceFilterUniqueness(nodes, workspaceId, currentNode);

  if (!currentNode.data.resourceFilter)
    return (
      <span className="mt-2 text-sm text-muted-foreground">
        Please add a resource filter to select resources for this environment.
      </span>
    );

  if (result == null)
    return (
      <div className="mt-2 flex items-center gap-1">
        {StatusMap.loading.icon}
        <span className="text-xs">{StatusMap.loading.text}</span>
      </div>
    );

  const { overlaps } = result;
  const isUnique = overlaps.length === 0;
  const { text: statusText, icon: statusIcon } = isUnique
    ? StatusMap.unique
    : StatusMap.overlapping;

  if (isUnique)
    return (
      <div className="mt-2 flex items-center gap-1">
        {statusIcon}
        <span className="text-xs">{statusText}</span>
      </div>
    );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-2 flex cursor-pointer items-center gap-1">
            {statusIcon}
            <span className="text-xs">{statusText}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[350px] p-2 text-sm">
          {overlaps.map((overlap) => {
            const overlappingNode = nodes.find(
              (node) => node.id === overlap.nodeId,
            );
            if (!overlappingNode) return null;
            const compressedFilter = LZString.compressToEncodedURIComponent(
              JSON.stringify({
                type: "comparison",
                operator: "and",
                conditions: [
                  overlappingNode.data.resourceFilter,
                  currentNode.data.resourceFilter,
                ],
              }),
            );
            return (
              <div key={overlap.nodeId}>
                <p className="mb-1 text-xs font-medium text-white">
                  <span className="font-medium text-white">
                    {overlappingNode.data.name}
                  </span>{" "}
                  <span className="text-muted-foreground">has</span>{" "}
                  <Link
                    href={`/${workspaceSlug}/resources?${new URLSearchParams({
                      filter: compressedFilter,
                    })}`}
                    className="text-muted-foreground underline"
                  >
                    <span className="text-white">
                      {overlap.overlappingResourceCount}
                    </span>
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    overlapping resource
                    {overlap.overlappingResourceCount > 1 ? "s" : ""}
                  </span>
                </p>
              </div>
            );
          })}
          <p className="mt-1 text-xs text-gray-300">
            This may happen if you added new resources that match multiple
            resource filters.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
