"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { Handle, Position } from "reactflow";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { useSidebar } from "@ctrlplane/ui/sidebar";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  activeStatus,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { api } from "~/trpc/react";
import { useSystemSidebarContext } from "./SystemSidebarContext";

export type ResourceNodeData =
  RouterOutputs["resource"]["visualize"]["resources"][number];

type System = ResourceNodeData["systems"][number];

const NodeHeader: React.FC<{ resource: schema.Resource }> = ({ resource }) => (
  <div className="flex items-center gap-2">
    <ResourceIcon
      version={resource.version}
      kind={resource.kind}
      className="h-8 w-8"
    />
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{resource.name}</span>
      <span className="text-xs text-muted-foreground">{resource.kind}</span>
    </div>
  </div>
);

const getStatusInfo = (statuses: (JobStatus | null)[]) => {
  const nonNullStatuses = statuses.filter(isPresent);

  const numFailed = nonNullStatuses.filter((s) =>
    failedStatuses.includes(s),
  ).length;
  const numActive = nonNullStatuses.filter((s) =>
    activeStatus.includes(s),
  ).length;
  const numPending = nonNullStatuses.filter(
    (s) => s === JobStatus.Pending,
  ).length;
  const numSuccessful = nonNullStatuses.filter(
    (s) => s === JobStatus.Successful,
  ).length;

  if (numFailed > 0)
    return {
      numSuccessful,
      Icon: <IconCircleX className="h-4 w-4 text-red-500" />,
    };
  if (numActive > 0)
    return {
      numSuccessful,
      Icon: <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />,
    };
  if (numPending > 0)
    return {
      numSuccessful,
      Icon: <IconClock className="h-4 w-4 text-neutral-400" />,
    };
  return {
    numSuccessful,
    Icon: <IconCircleCheck className="h-4 w-4 text-green-500" />,
  };
};

const SystemStatus: React.FC<{
  resourceId: string;
  systemId: string;
}> = ({ resourceId, systemId }) => {
  const { data, isLoading } = api.resource.systemOverview.useQuery({
    resourceId,
    systemId,
  });

  if (isLoading) return <Skeleton className="h-4 w-16" />;

  const statuses = (data ?? []).map((d) => d.status);
  const { numSuccessful, Icon } = getStatusInfo(
    statuses as (JobStatus | null)[],
  );

  return (
    <div className="flex items-center gap-2">
      {Icon}
      <span>
        {numSuccessful}/{statuses.length}
      </span>
    </div>
  );
};

const useHandleSystemClick = (system: System, resource: schema.Resource) => {
  const { toggleSidebar, open } = useSidebar();
  const { system: sidebarSystem, setSystem } = useSystemSidebarContext();

  const isSystemSelected = sidebarSystem?.id === system.id;
  const isSidebarOpen = open.includes("resource-visualization");

  return () => {
    if (isSystemSelected && isSidebarOpen) {
      toggleSidebar(["resource-visualization"]);
      setSystem(null);
      return;
    }

    const newSystem = isSystemSelected ? null : { ...system, resource };
    setSystem(newSystem);
    if (!isSidebarOpen) toggleSidebar(["resource-visualization"]);
  };
};

const useIsSystemSelected = (system: System, resource: schema.Resource) => {
  const { system: sidebarSystem } = useSystemSidebarContext();
  return (
    sidebarSystem?.id === system.id && sidebarSystem.resource.id === resource.id
  );
};

const SystemSection: React.FC<{
  resource: schema.Resource;
  system: System;
}> = ({ resource, system }) => {
  const handleClick = useHandleSystemClick(system, resource);
  const isSystemSelected = useIsSystemSelected(system, resource);

  return (
    <Button
      variant="ghost"
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-md border bg-neutral-800/50 px-3 py-2 hover:border-neutral-600 hover:bg-neutral-800",
        isSystemSelected && "border-neutral-600 bg-neutral-800",
      )}
      onClick={handleClick}
    >
      <span>{capitalCase(system.name)}</span>
      <SystemStatus resourceId={resource.id} systemId={system.id} />
    </Button>
  );
};

const useIsResourceSelected = (resource: schema.Resource) => {
  const { system: sidebarSystem } = useSystemSidebarContext();
  return sidebarSystem?.resource.id === resource.id;
};

type ResourceNodeProps = NodeProps<{
  data: ResourceNodeData;
}>;
export const ResourceNode: React.FC<ResourceNodeProps> = (node) => {
  const { data } = node.data;
  const isResourceSelected = useIsResourceSelected(data);

  return (
    <>
      <div
        className={cn(
          "flex w-[400px] flex-col gap-4 rounded-md border bg-neutral-900/30 p-3",
          isResourceSelected && "border-neutral-600",
        )}
      >
        <NodeHeader resource={data} />
        {data.systems.length === 0 && (
          <div className="flex h-10 items-center justify-center rounded-md border bg-neutral-800/50 text-muted-foreground">
            Not part of any system
          </div>
        )}
        {data.systems.map((system) => (
          <SystemSection key={system.id} resource={data} system={system} />
        ))}
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Right}
      />
    </>
  );
};
