import type { Target } from "@ctrlplane/db/schema";
import type { Node } from "reactflow";
import React, { useMemo } from "react";
import { IconAlertTriangle, IconCircleFilled } from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";

import { cn } from "@ctrlplane/ui";
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
): UniqueFilterResult | null => {
  const utils = api.useUtils();
  const filteredNodes = useMemo(
    () => nodes.filter((node) => node.data.targetFilter),
    [nodes],
  );

  const queries = useQueries({
    queries: filteredNodes.map((node) => ({
      queryKey: [
        "target",
        workspaceId,
        JSON.stringify(node.data.targetFilter),
        node.id,
      ],
      queryFn: () =>
        utils.target.byWorkspaceId.list.fetch({
          workspaceId,
          filter: node.data.targetFilter,
        }),
      enabled: Boolean(workspaceId),
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);

  const calculateResult = () => {
    if (!workspaceId || filteredNodes.length === 0 || isLoading) return null;
    if (isError) return { isUnique: false, overlaps: [] };

    const results = queries.map((query, index) => ({
      nodeId: filteredNodes[index]?.id ?? "",
      targets: query.data?.items ?? [],
    }));

    const targetToNodesMap = results.reduce<Record<string, Set<string>>>(
      (acc, { nodeId, targets }) => {
        targets.forEach((target) => {
          acc[target.id] ??= new Set<string>();
          acc[target.id]?.add(nodeId);
        });
        return acc;
      },
      {},
    );

    const duplicateTargetIds = Object.entries(targetToNodesMap)
      .filter(([_, nodeIds]) => nodeIds.size > 1)
      .map(([targetId]) => targetId);

    if (duplicateTargetIds.length === 0)
      return { isUnique: true, overlaps: [] };

    const overlaps = results
      .map(({ nodeId, targets }) => ({
        nodeId,
        overlappingTargets: targets.filter((target) =>
          duplicateTargetIds.includes(target.id),
        ),
      }))
      .filter(({ overlappingTargets }) => overlappingTargets.length > 0);

    return {
      isUnique: overlaps.length === 0,
      overlaps,
    };
  };

  return useMemo(calculateResult, [
    workspaceId,
    filteredNodes,
    queries,
    isLoading,
    isError,
  ]);
};

export const TargetFilterUniquenessIndicator: React.FC<{
  nodes: Node[];
  workspaceId: string;
}> = ({ nodes, workspaceId }) => {
  const result = useTargetFilterUniqueness(nodes, workspaceId);

  const tooltipContent = !result ? (
    <p className="text-sx p-1 text-gray-300">Checking target uniqueness...</p>
  ) : result.isUnique ? (
    <p className="text-sx p-1 text-gray-300">
      All Environments have unique targets
    </p>
  ) : (
    <div className="rounded-md bg-neutral-800/70 p-2">
      <p className="flex items-center font-semibold">
        <IconAlertTriangle className="mr-1 h-6 w-6 text-red-400" />
        Targets overlap Environments for this System
      </p>
      <p className="text-gray-300">
        This may happen if you added new targets that match multiple target
        filters.
      </p>
      {result.overlaps.map((overlap, index) => (
        <div key={index} className="mt-2">
          <p className="font-medium">
            Environment{" "}
            <span className="font-medium text-muted-foreground">
              {nodes.find((node) => node.id === overlap.nodeId)?.data.name}
            </span>{" "}
            has overlapping targets:
          </p>
          <ul>
            {overlap.overlappingTargets.slice(0, 3).map((target) => (
              <li key={target.id} className="text-gray-400">
                {target.name}
              </li>
            ))}
            {overlap.overlappingTargets.length > 3 && (
              <li className="text-gray-400">...</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );

  const colorClasses = result
    ? result.isUnique
      ? { outer: "text-green-300/20", inner: "text-green-300" }
      : { outer: "text-red-300/20", inner: "text-red-300" }
    : { outer: "text-gray-300/20", inner: "text-gray-300" };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="relative h-[25px] w-[25px]">
            <IconCircleFilled
              className={cn(
                "absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2",
                colorClasses.outer,
              )}
            />
            <IconCircleFilled
              className={cn(
                "absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2",
                colorClasses.inner,
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[350px] p-0">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
