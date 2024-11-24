import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconBrandGoogleFilled, IconCube } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";

type ProviderNodeProps = NodeProps<{
  id: string;
  name: string;
  label: string;
  workspaceId: string;
  google: SCHEMA.ResourceProviderGoogle | null;
}>;

export const ProviderIcon: React.FC<{ node: ProviderNodeProps }> = ({
  node,
}) => {
  const { google } = node.data;
  if (google != null)
    return <IconBrandGoogleFilled className="h-4 w-4 text-red-500" />;
  return <IconCube className="h-4 w-4 text-neutral-500" />;
};

const ProviderLabel: React.FC<{ node: ProviderNodeProps }> = ({ node }) => {
  const { google } = node.data;
  if (google != null)
    return <span className="text-xs text-red-500">Google Provider</span>;
  return <span className="text-xs">Resource Provider</span>;
};

export const ProviderNode: React.FC<ProviderNodeProps> = (node) => {
  const { data } = node;
  return (
    <>
      <div
        className={cn(
          "relative flex w-[250px] flex-col gap-2 rounded-md border border-green-600 bg-green-900/30 px-4 py-3",
          node.data.google != null && "border-red-600 bg-red-900/30",
        )}
      >
        <div className="flex items-center gap-2">
          <ProviderIcon node={node} />
          <ProviderLabel node={node} />
        </div>
        <div className="text-sm">{data.label}</div>
      </div>
      <Handle
        type="target"
        className={cn(
          "h-2 w-2 rounded-full border border-green-500 bg-neutral-800",
          data.google != null && "border-red-500 bg-red-800",
        )}
        position={Position.Left}
      />
      <Handle
        type="source"
        className={cn(
          "h-2 w-2 rounded-full border border-green-500 bg-neutral-800",
          data.google != null && "border-red-500 bg-red-800",
        )}
        position={Position.Right}
      />
    </>
  );
};
