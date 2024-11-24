import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";

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

  const isKubernetes = data.version.includes("kubernetes");
  const isTerraform = data.version.includes("terraform");
  const isSharedCluster = data.kind.toLowerCase().includes("sharedcluster");

  return (
    <>
      <div
        className={cn(
          "flex w-[250px] flex-col gap-2 rounded-md border bg-neutral-900 px-4 py-3",
          isKubernetes && "border-blue-500/70 bg-blue-500/20",
          isTerraform && "border-purple-500/70 bg-purple-500/20",
          isSharedCluster && "border-blue-500/70 bg-blue-500/20",
        )}
      >
        <div className="flex items-center gap-2">
          <ResourceIcon version={data.version} kind={data.kind} />
          <span className="text-xs">{data.kind}</span>
        </div>
        <div className="text-sm">{data.name}</div>
      </div>

      <Handle
        type="target"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-500 bg-neutral-800",
          isKubernetes && "border-blue-500/70",
          isTerraform && "border-purple-500/70",
          isSharedCluster && "border-blue-500/70",
        )}
        position={Position.Left}
      />
      <Handle
        type="source"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-500 bg-neutral-800",
          isKubernetes && "border-blue-500/70",
          isTerraform && "border-purple-500/70",
          isSharedCluster && "border-blue-500/70",
        )}
        position={Position.Right}
      />
    </>
  );
};
