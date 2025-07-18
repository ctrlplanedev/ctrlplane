"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { capitalCase } from "change-case";
import { Handle, Position } from "reactflow";

import { Button } from "@ctrlplane/ui/button";

import type { ResourceNodeData, System } from "../types";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
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
      <div className="flex flex-1 items-center gap-2 ">
        <ResourceIcon
          version={resource.version}
          kind={resource.kind}
          className="h-8 w-8"
        />
        <div className="flex max-w-64 flex-col gap-0.5">
          <span className="truncate font-medium">{resource.name}</span>
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

const SystemSection: React.FC<{
  resource: schema.Resource;
  system: System;
}> = ({ resource, system }) => {
  return (
    <div className="flex items-center justify-between rounded-md border bg-neutral-800/50 px-3 py-2">
      <span>{capitalCase(system.name)}</span>
      <SystemStatus resourceId={resource.id} systemId={system.id} />
    </div>
  );
};

type ResourceNodeProps = NodeProps<{
  data: ResourceNodeData;
}>;
export const ResourceNode: React.FC<ResourceNodeProps> = (node) => {
  const { data } = node.data;

  return (
    <>
      <div className="flex w-[400px] flex-col gap-4 rounded-md border bg-neutral-900/30 p-3 hover:bg-neutral-900/60">
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
