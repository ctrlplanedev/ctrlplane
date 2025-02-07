import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconBrandGoogleFilled, IconCube } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

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
  if (google != null) return <span className="text-xs ">Google Provider</span>;
  return <span className="text-xs">Resource Provider</span>;
};

export const ProviderNode: React.FC<ProviderNodeProps> = (node) => {
  const { data } = node;
  return (
    <>
      <div className="relative flex w-[250px] flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <ProviderIcon node={node} />
          <ProviderLabel node={node} />
        </div>
        <span className="truncate text-sm">{data.label}</span>
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
