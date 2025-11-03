/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

import { Badge } from "~/components/ui/badge";

type VersionNodeData = {
  id?: string;
  name?: string;
  tag?: string;
  status?: string;
  message?: string;
};

export const VersionNode = ({ data }: NodeProps<VersionNodeData>) => {
  const { name, tag } = data;
  return (
    <div className="flex min-w-[200px] items-center justify-between rounded-lg border-2 border-primary bg-card p-4 shadow-lg">
      <span className="font-semibold text-primary">Trigger</span>
      <Badge variant="outline" className="ml-2 text-xs">
        {name || tag}
      </Badge>
      <Handle
        type="source"
        position={Position.Right}
        className="h-4 w-4 !bg-primary"
      />
    </div>
  );
};
