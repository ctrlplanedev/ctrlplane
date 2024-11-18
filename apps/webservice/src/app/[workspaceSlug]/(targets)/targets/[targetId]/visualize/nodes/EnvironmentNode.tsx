import type { NodeProps } from "reactflow";
import { IconPlant } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

export const EnvironmentNode: React.FC<NodeProps> = (node) => {
  const { data } = node;
  return (
    <>
      <div className="relative flex w-[250px] flex-col gap-2 rounded-md border border-green-600 bg-green-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <IconPlant className="h-4 w-4 text-green-500" />
          <span className="text-xs">Environment</span>
        </div>
        <div className="text-sm">{data.label}</div>
      </div>
      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-green-500"
        style={{
          background: colors.neutral[800],
        }}
        position={Position.Top}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-green-500"
        style={{
          bottom: "0",
          left: "50%",
          transform: "translate(-50%, 50%)",
          background: colors.neutral[800],
        }}
        position={Position.Bottom}
      />
    </>
  );
};
