import type { NodeProps, NodeTypes } from "reactflow";
import {
  TbBolt,
  TbCircleCheck,
  TbPlant,
  TbRegex,
  TbTarget,
  TbUser,
  TbVersions,
} from "react-icons/tb";
import { Handle, Position, useReactFlow } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";

import { usePanel } from "./SidepanelContext";

export enum NodeType {
  Trigger = "trigger",
  Environment = "environment",
  Policy = "policy",
}

const PolicyNode: React.FC<NodeProps> = ({ id, data }) => {
  const { setSelectedNodeId, selectedNodeId } = usePanel();
  const isSelected = selectedNodeId === id;
  const { getEdges } = useReactFlow();
  const hasChildren = getEdges().find((a) => a.source === id) != null;
  const isManual = data.approvalRequirement === "manual";
  const isRegex = data.channel?.type === "regex";
  const isSemver = data.channel?.type === "semver";
  return (
    <>
      <div
        className={cn(
          "relative flex min-h-10 flex-col justify-center gap-1 rounded-full border bg-neutral-900 p-2 text-center text-xs",
          isSelected && "border-neutral-300",
        )}
        onMouseDownCapture={() => setSelectedNodeId(id)}
      >
        <div className={cn("flex items-center justify-center gap-1")}>
          <TbCircleCheck className="text-teal-400" />
          {isRegex && <TbRegex className="text-pink-400" />}
          {isSemver && <TbVersions className="text-pink-500" />}
          {isManual ? (
            <TbUser className="text-red-400" />
          ) : (
            <TbBolt className="text-yellow-400" />
          )}
        </div>
        {isSelected && !hasChildren && (
          <div className="absolute -bottom-14 left-1/2 flex w-[150px] -translate-x-1/2 flex-col items-center rounded-md">
            <div>
              <div className="h-8 border-l border-dashed border-neutral-400" />
            </div>
            <button
              style={{ fontSize: 10 }}
              className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-400 hover:border-neutral-300 hover:text-neutral-300"
            >
              New Environment
            </button>
          </div>
        )}
      </div>
      <Handle
        type="target"
        className="border-1 h-2 w-2 rounded-full bg-purple-500"
        style={{
          background: colors.neutral[800],
        }}
        position={Position.Top}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-white"
        style={{
          bottom: "0",
          left: "50%",
          transform: "translate(-50%, 50%)",
          background: colors.neutral[900],
        }}
        position={Position.Bottom}
      />
    </>
  );
};

const EnvironmentNode: React.FC<NodeProps> = (node) => {
  const { data } = node;
  const { setSelectedNodeId, selectedNodeId } = usePanel();
  const isSelected = selectedNodeId === node.id;
  const hasDescription = data.description != null && data.description !== "";
  return (
    <>
      <div
        className={cn(
          "relative w-[300px] rounded-md border bg-neutral-900",
          isSelected && "border-green-500",
        )}
        onMouseDownCapture={() => setSelectedNodeId(node.id)}
      >
        <div className="flex items-center gap-2 border-b p-4">
          <div className="rounded-md bg-green-500/20 p-1">
            <TbPlant className="text-green-500" />
          </div>
          {data.label}
        </div>
        <div
          className={cn(
            "p-4 text-xs",
            !hasDescription && "italic text-muted-foreground",
          )}
        >
          {hasDescription
            ? data.description
            : "Add a description for this environment."}
        </div>
      </div>
      <Handle
        type="target"
        className="border-1 h-2 w-2 rounded-full bg-green-500"
        style={{
          background: colors.neutral[800],
        }}
        position={Position.Top}
      />
      <Handle
        type="source"
        className="h-3 w-3 rounded-full border-2 border-green-500"
        style={{
          bottom: "0",
          left: "50%",
          transform: "translate(-50%, 50%)",
          background: colors.neutral[900],
        }}
        position={Position.Bottom}
      />
    </>
  );
};

const TriggerNode: React.FC<NodeProps> = ({ id, data }) => {
  const { setSelectedNodeId, selectedNodeId } = usePanel();
  const isSelected = selectedNodeId === id;
  return (
    <>
      <div
        className={cn("relative w-[300px]")}
        onMouseDownCapture={() => setSelectedNodeId(id)}
      >
        <div className="absolute bottom-[100%] -z-10 flex items-center gap-1 rounded-t bg-blue-500/20 p-1 text-xs">
          <TbTarget className="text-blue-500" /> Trigger
        </div>
        <div
          className={cn(
            "relative rounded-b-md rounded-r-md border bg-neutral-900",
            isSelected && "border-blue-500",
          )}
        >
          <div className="flex items-center gap-2 border-b p-4">
            <div className="rounded-md bg-blue-500/20 p-1">
              <TbBolt className="text-blue-500" />
            </div>
            {data.label}
          </div>
          <div className={cn("p-4 text-xs text-muted-foreground")}>
            {data.description ??
              "This will trigger the flow when a new release is created."}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        className="h-3 w-3 rounded-full border-2 border-blue-500"
        style={{
          bottom: "0",
          left: "50%",
          transform: "translate(-50%, 50%)",
          background: colors.neutral[900],
        }}
        position={Position.Bottom}
      />
    </>
  );
};

export const nodeTypes: NodeTypes = {
  [NodeType.Trigger]: TriggerNode,
  [NodeType.Environment]: EnvironmentNode,
  [NodeType.Policy]: PolicyNode,
};
