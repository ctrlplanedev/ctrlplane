import type { NodeProps } from "reactflow";
import { IconShip } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

export const DeploymentNode: React.FC<NodeProps> = (node) => {
  const { data } = node;
  return (
    <>
      <div className="relative flex w-[250px] flex-col gap-2 rounded-md border border-amber-600 bg-amber-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <IconShip className="h-4 w-4 text-amber-500" />
          <span className="text-xs">Deployment</span>
        </div>
        <div className="text-sm">{data.label}</div>
      </div>
      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-amber-500 bg-neutral-800"
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-amber-500 bg-neutral-800"
        position={Position.Right}
      />
    </>
  );
};
