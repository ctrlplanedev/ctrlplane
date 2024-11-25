import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

import { TargetIcon as ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/TargetIcon";

type ResourceNodeProps = NodeProps<{
  name: string;
  label: string;
  id: string;
  kind: string;
  version: string;
}>;
export const ResourceNode: React.FC<ResourceNodeProps> = (node) => {
  const { data } = node;

  return (
    <>
      <div className="flex w-[250px] flex-col gap-2 rounded-md border bg-neutral-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <ResourceIcon version={data.version} kind={data.kind} />
          <span className="text-xs">{data.kind}</span>
        </div>
        <span className="truncate text-sm">{data.name}</span>
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Top}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Bottom}
      />
    </>
  );
};
