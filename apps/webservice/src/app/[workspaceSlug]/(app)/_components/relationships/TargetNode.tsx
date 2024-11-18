import type { CSSProperties } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";

import { TargetIcon } from "../TargetIcon";
import { getBorderColor } from "../targets/getBorderColor";

type TargetNodeProps = NodeProps<{
  name: string;
  label: string;
  id: string;
  kind: string;
  version: string;
  targetId: string;
  isOrphanNode: boolean;
}>;
export const TargetNode: React.FC<TargetNodeProps> = (node) => {
  const { data } = node;

  const isKubernetes = data.version.includes("kubernetes");
  const isTerraform = data.version.includes("terraform");
  const isSharedCluster = data.kind.toLowerCase().includes("sharedcluster");
  const isSelected = data.id === data.targetId && !data.isOrphanNode;
  const animatedBorderColor = getBorderColor(data.version, data.kind);
  const selectedStyle: CSSProperties | undefined = isSelected
    ? {
        position: "relative",
        borderColor: "transparent",
        backgroundClip: "padding-box",
      }
    : undefined;

  return (
    <>
      <div
        className={cn(
          "flex w-[250px] flex-col gap-2 rounded-md border bg-neutral-900 px-4 py-3",
          isKubernetes && "border-blue-500/70 bg-blue-500/20",
          isTerraform && "border-purple-500/70 bg-purple-500/20",
          isSharedCluster && "border-blue-500/70 bg-blue-500/20",
        )}
        style={selectedStyle}
      >
        {isSelected && <div className="animated-border" />}
        <div className="flex items-center gap-2">
          <TargetIcon version={data.version} kind={data.kind} />
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
        position={Position.Bottom}
      />
      <Handle
        type="source"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-500 bg-neutral-800",
          isKubernetes && "border-blue-500/70",
          isTerraform && "border-purple-500/70",
          isSharedCluster && "border-blue-500/70",
        )}
        position={Position.Top}
      />
      <style jsx>{`
        .animated-border {
          position: absolute;
          top: -1px;
          left: -1px;
          right: -1px;
          bottom: -1px;
          background-image: linear-gradient(
              90deg,
              ${animatedBorderColor} 50%,
              transparent 50%
            ),
            linear-gradient(90deg, ${animatedBorderColor} 50%, transparent 50%),
            linear-gradient(0deg, ${animatedBorderColor} 50%, transparent 50%),
            linear-gradient(0deg, ${animatedBorderColor} 50%, transparent 50%);
          background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
          background-size:
            20px 1px,
            20px 1px,
            1px 20px,
            1px 20px;
          background-position:
            0 0,
            0 100%,
            0 0,
            100% 0;
          border-radius: calc(0.5rem - 2px);
          animation: moveDashedBorder 1s linear infinite;
          pointer-events: none;
        }

        @keyframes moveDashedBorder {
          0% {
            background-position:
              0 0,
              0 100%,
              0 0,
              100% 0;
          }
          100% {
            background-position:
              20px 0,
              -20px 100%,
              0 -20px,
              100% 20px;
          }
        }
      `}</style>
    </>
  );
};
