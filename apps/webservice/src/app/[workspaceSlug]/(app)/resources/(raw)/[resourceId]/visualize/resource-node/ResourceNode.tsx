"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { capitalCase } from "change-case";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { useSidebar } from "@ctrlplane/ui/sidebar";

import type { ResourceNodeData, System } from "../types";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { useSystemSidebarContext } from "../SystemSidebarContext";
import { SystemStatus } from "./SystemStatus";
import { useResourceCollapsibleToggle } from "./useResourceCollapsibleToggle";

const NodeHeader: React.FC<{ resource: schema.Resource }> = ({ resource }) => {
  const {
    numHiddenDirectChildren,
    numDirectChildren,
    expandResource,
    collapseResource,
  } = useResourceCollapsibleToggle(resource.id);

  return (
    <div className="flex justify-between">
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
      {numHiddenDirectChildren > 0 && (
        <Button
          size="sm"
          className="h-6 flex-shrink-0 rounded-full px-2"
          onClick={expandResource}
        >
          +{numHiddenDirectChildren}
        </Button>
      )}
      {numDirectChildren > 0 && numHiddenDirectChildren === 0 && (
        <Button
          size="sm"
          className="h-6 flex-shrink-0 rounded-full px-2"
          onClick={collapseResource}
        >
          collapse
        </Button>
      )}
    </div>
  );
};

const useHandleSystemClick = (system: System, resource: schema.Resource) => {
  const { toggleSidebar, open } = useSidebar();
  const { resourceAndSystem, setResourceAndSystem } = useSystemSidebarContext();

  const isResourceAndSystemSelected =
    resourceAndSystem?.system.id === system.id &&
    resourceAndSystem.resource.id === resource.id;
  const isSidebarOpen = open.includes("resource-visualization");

  const shouldCloseSidebar = isResourceAndSystemSelected && isSidebarOpen;
  return () => {
    if (shouldCloseSidebar) {
      toggleSidebar(["resource-visualization"]);
      setResourceAndSystem(null);
      return;
    }

    const newResourceAndSystem = isResourceAndSystemSelected
      ? null
      : { system, resource };
    setResourceAndSystem(newResourceAndSystem);
    if (!isSidebarOpen) toggleSidebar(["resource-visualization"]);
  };
};

const useIsSystemAndResourceSelected = (
  system: System,
  resource: schema.Resource,
) => {
  const { resourceAndSystem } = useSystemSidebarContext();
  return (
    resourceAndSystem?.system.id === system.id &&
    resourceAndSystem.resource.id === resource.id
  );
};

const SystemSection: React.FC<{
  resource: schema.Resource;
  system: System;
}> = ({ resource, system }) => {
  const handleClick = useHandleSystemClick(system, resource);
  const isSystemAndResourceSelected = useIsSystemAndResourceSelected(
    system,
    resource,
  );

  return (
    <Button
      variant="ghost"
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-md border bg-neutral-800/50 px-3 py-2 hover:border-neutral-700 hover:bg-neutral-800",
        isSystemAndResourceSelected && "border-neutral-700 bg-neutral-800",
      )}
      onClick={handleClick}
    >
      <span>{capitalCase(system.name)}</span>
      <SystemStatus resourceId={resource.id} systemId={system.id} />
    </Button>
  );
};

const useIsResourceSelected = (resource: schema.Resource) => {
  const { resourceAndSystem } = useSystemSidebarContext();
  return resourceAndSystem?.resource.id === resource.id;
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
