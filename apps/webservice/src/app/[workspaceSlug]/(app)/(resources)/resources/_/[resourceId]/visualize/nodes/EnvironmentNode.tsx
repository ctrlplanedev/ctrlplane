"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconPlant } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

import { useEnvironmentDrawer } from "~/app/[workspaceSlug]/(app)/_components/environment-drawer/EnvironmentDrawer";

type Environment = NonNullable<
  RouterOutputs["resource"]["relationships"]
>["nodes"][number]["workspace"]["systems"][number]["environments"][number];

type EnvironmentNodeProps = NodeProps<{
  label: string;
  environment: Environment;
}>;

export const EnvironmentNode: React.FC<EnvironmentNodeProps> = (node) => {
  const { data } = node;
  const { setEnvironmentId } = useEnvironmentDrawer();
  return (
    <>
      <div
        className="relative flex w-[250px] cursor-pointer flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4 py-3"
        onClick={() => setEnvironmentId(data.environment.id)}
      >
        <div className="flex items-center gap-2">
          <IconPlant className="h-4 w-4 text-green-500" />
          <span className="text-xs">Environment</span>
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
        position={Position.Right}
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
      />
    </>
  );
};
