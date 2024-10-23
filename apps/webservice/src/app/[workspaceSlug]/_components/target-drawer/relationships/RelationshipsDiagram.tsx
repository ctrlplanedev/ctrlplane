"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { CSSProperties } from "react";
import type {
  EdgeProps,
  EdgeTypes,
  NodeProps,
  NodeTypes,
  ReactFlowInstance,
} from "reactflow";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";

import { getLayoutedElementsDagre } from "~/app/[workspaceSlug]/_components/reactflow/layout";
import { TargetIcon } from "~/app/[workspaceSlug]/_components/TargetIcon";
import { api } from "~/trpc/react";
import { useTargetDrawer } from "../TargetDrawer";

const getAnimatedBorderColor = (version: string): string => {
  if (version.includes("kubernetes")) return "#3b82f6";
  if (version.includes("terraform")) return "#8b5cf6";
  return "#a3a3a3";
};

type TargetNodeProps = NodeProps<{
  name: string;
  label: string;
  id: string;
  kind: string;
  version: string;
}>;
const TargetNode: React.FC<TargetNodeProps> = (node) => {
  const { targetId } = useTargetDrawer();
  const { data } = node;

  const isKubernetes = data.version.includes("kubernetes");
  const isTerraform = data.version.includes("terraform");
  const isSelected = data.id === targetId;

  const animatedBorderColor = getAnimatedBorderColor(data.version);

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
          "flex flex-col items-center justify-center text-center",
          "w-[250px] gap-2 rounded-md border bg-neutral-900 px-4 py-3",
          isKubernetes && "border-blue-500/70 bg-blue-500/20",
          isTerraform && "border-purple-500/70 bg-purple-500/20",
        )}
        style={selectedStyle}
      >
        {isSelected && <div className="animated-border" />}
        <div className="flex h-12 w-12 items-center justify-center rounded-full">
          <TargetIcon version={data.version} kind={data.kind} />
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {data.kind}
        </div>
        <div className="text-base font-semibold">{data.label}</div>
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Top}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Bottom}
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

const DepEdge: React.FC<EdgeProps> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ strokeWidth: 2, ...style }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 16,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
          }}
          className="nodrag nopan z-10"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes: NodeTypes = { target: TargetNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const useOnLayout = () => {
  const { getNodes, fitView, setNodes, setEdges, getEdges } = useReactFlow();
  return useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      "TB",
      0,
      50,
    );
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    fitView({ padding: 0.12, maxZoom: 1 });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
};

const TargetDiagram: React.FC<{
  relationships: Array<schema.TargetRelationship>;
  targets: Array<schema.Target>;
}> = ({ relationships, targets }) => {
  const [nodes, _, onNodesChange] = useNodesState(
    targets.map((t) => ({
      id: t.id,
      type: "target",
      position: { x: 0, y: 0 },
      data: t,
    })),
  );
  const [edges, __, onEdgesChange] = useEdgesState(
    relationships.map((t) => {
      return {
        id: `${t.sourceId}-${t.targetId}`,
        source: t.sourceId,
        target: t.targetId,
        markerEnd: { type: MarkerType.Arrow, color: colors.neutral[500] },
        style: { stroke: colors.neutral[500] },
      };
    }),
  );
  const onLayout = useOnLayout();

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={[]}
      onInit={setReactFlowInstance}
      nodesDraggable
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
    />
  );
};

export const TargetHierarchyRelationshipsDiagram: React.FC<{
  targetId: string;
}> = ({ targetId }) => {
  const hierarchy = api.target.relations.hierarchy.useQuery(targetId);

  if (hierarchy.data == null) return null;
  const { relationships, targets } = hierarchy.data;
  return (
    <ReactFlowProvider>
      <TargetDiagram relationships={relationships} targets={targets} />
    </ReactFlowProvider>
  );
};
