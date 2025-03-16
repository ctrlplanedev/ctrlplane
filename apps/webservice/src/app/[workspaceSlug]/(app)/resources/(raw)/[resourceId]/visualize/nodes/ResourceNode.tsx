import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";

import { useResourceDrawer } from "~/app/[workspaceSlug]/(app)/_components/resources/drawer/useResourceDrawer";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";

type ResourceNodeProps = NodeProps<{
  name: string;
  label: string;
  id: string;
  kind: string;
  version: string;
  isBaseNode: boolean;
}>;
export const ResourceNode: React.FC<ResourceNodeProps> = (node) => {
  const { data } = node;
  const { setResourceId } = useResourceDrawer();
  return (
    <>
      <div
        className={cn(
          "flex w-[250px] cursor-pointer flex-col gap-2 rounded-md border bg-neutral-900/30 px-4 py-3",
          data.isBaseNode && "bg-neutral-800/60",
        )}
        onClick={() => setResourceId(data.id)}
      >
        <div className="flex items-center gap-2">
          <ResourceIcon version={data.version} kind={data.kind} />
          <span className="text-xs">{data.kind}</span>
        </div>
        <span className="truncate text-sm">{data.name}</span>
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
