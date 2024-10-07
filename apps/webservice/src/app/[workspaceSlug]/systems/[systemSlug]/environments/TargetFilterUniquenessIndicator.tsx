import type { Target } from "@ctrlplane/db/schema";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Node } from "reactflow";
import React, { useMemo } from "react";
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
  isUnique: boolean;
  overlaps: {
    nodeId: string;
    overlappingTargets: Target[];
  }[];
};

export const useTargetFilterUniqueness = (
  nodes: Node[],
  workspaceId: string,
  currentNode: Node,
): UniqueFilterResult | null => {
  const utils = api.useUtils();
  const otherNodes = useMemo(
    () => nodes.filter((node) => node.id !== currentNode.id),
    [nodes, currentNode.id],
  );

  const overlappingQueries: UseQueryResult<Target[], Error>[] = useQueries({
    queries: otherNodes.map((node) => ({
      queryKey: [
        "target",
        "overlappingTargets",
        workspaceId,
        currentNode.data.targetFilter,
        node.data.targetFilter,
        node.id,
      ],
      queryFn: () =>
        utils.target.byWorkspaceId.overlappingTargets.fetch({
          workspaceId,
          filterA: currentNode.data.targetFilter,
          filterB: node.data.targetFilter,
        }),
      enabled: Boolean(
        workspaceId && currentNode.data.targetFilter && node.data.targetFilter,
      ),
    })),
  });

  new Promise((resolve) => setTimeout(resolve, 1000));

  const isLoading = overlappingQueries.some((query) => query.isLoading);
  const isError = overlappingQueries.some((query) => query.isError);

  const overlaps = useMemo(() => {
    if (isLoading || isError) return null;

    const overlappingResults = overlappingQueries
      .map((query, index) => {
        const overlappingTargets = query.data ?? [];
        return overlappingTargets.length > 0
          ? {
              nodeId: otherNodes[index]?.id,
              overlappingTargets,
            }
          : null;
      })
      .filter(Boolean) as {
      nodeId: string;
      overlappingTargets: Target[];
    }[];

    return {
      isUnique: overlappingResults.length === 0,
      overlaps: overlappingResults,
    };
  }, [isLoading, isError, overlappingQueries, otherNodes]);

  return overlaps;
};

const statusMap = {
  loading: {
    text: "Checking target uniqueness...",
    icon: <IconLoader className="mr-1 h-4 w-4 animate-spin text-blue-500" />,
  },
  unique: {
    text: "All Environments have unique targets",
    icon: <IconCheck className="mr-1 h-4 w-4 text-green-400" />,
  },
  overlapping: {
    text: "Targets overlap Environments for this System",
    icon: <IconAlertTriangle className="mr-1 h-4 w-4 text-orange-400" />,
  },
};

export const TargetFilterUniquenessIndicator: React.FC<{
  nodes: Node[];
  workspaceId: string;
  workspaceSlug: string;
  currentNode: Node;
}> = ({ nodes, workspaceId, workspaceSlug, currentNode }) => {
  const result = useTargetFilterUniqueness(nodes, workspaceId, currentNode);

  if (!currentNode.data.targetFilter)
    return (
      <span className="mt-2 text-sm text-muted-foreground">
        Please add a target filter to select targets for this environment.
      </span>
    );

  if (result === null)
    return (
      <div className="mt-2 flex items-center gap-1">
        {statusMap.loading.icon}
        <span className="text-xs">{statusMap.loading.text}</span>
      </div>
    );

  const { text: statusText, icon: statusIcon } = result.isUnique
    ? statusMap.unique
    : statusMap.overlapping;

  return !result.isUnique ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger onClick={(e) => e.preventDefault()}>
          <div className="mt-2 flex items-center gap-1">
            {statusIcon}
            <span className="text-xs">{statusText}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="mt-2 max-w-[350px] p-2 text-sm">
          {result.overlaps.map((overlap) => {
            const overlappingNode = nodes.find(
              (node) => node.id === overlap.nodeId,
            );
            return (
              <div key={overlap.nodeId}>
                <p className="mt-2 text-xs font-medium text-white">
                  <span className="font-medium text-white">
                    {overlappingNode?.data.name ?? "Unknown"}
                  </span>{" "}
                  <span className="text-muted-foreground">has</span>{" "}
                  <Link
                    href={`/${workspaceSlug}/targets?${new URLSearchParams({
                      filter: LZString.compressToEncodedURIComponent(
                        JSON.stringify(
                          overlappingNode?.data.targetFilter ?? {},
                        ),
                      ),
                    })}`}
                    className="text-muted-foreground underline"
                  >
                    <span className="text-white">
                      {overlap.overlappingTargets.length}
                    </span>
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    overlapping targets
                  </span>
                </p>
              </div>
            );
          })}
          <p className="mt-1 text-xs text-gray-300">
            This may happen if you added new targets that match multiple target
            filters.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <div className="mt-2 flex items-center gap-1">
      {" "}
      {statusIcon}
      <span className="text-xs">{statusText}</span>
    </div>
  );
};
