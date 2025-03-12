import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconBolt, IconTarget } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

type TriggerNodeProps = NodeProps<SCHEMA.DeploymentVersion & { label: string }>;

export const TriggerNode: React.FC<TriggerNodeProps> = ({ data }) => (
  <>
    <div className="relative w-[250px]">
      <div className="absolute bottom-[100%] -z-10 flex items-center gap-1 rounded-t bg-blue-500/20 p-1 text-xs">
        <IconTarget className="h-3 w-3 text-blue-500" /> Trigger
      </div>
      <div className="relative rounded-b-md rounded-r-md border bg-neutral-900">
        <div className="flex items-center gap-2 border-b p-2">
          <div className="rounded-md bg-blue-500/20 p-1">
            <IconBolt className="h-4 w-4 text-blue-500" />
          </div>
          {data.label}
        </div>
      </div>
    </div>
    <Handle
      type="source"
      className="h-2 w-2 rounded-full border border-blue-500"
      position={Position.Right}
    />
  </>
);
