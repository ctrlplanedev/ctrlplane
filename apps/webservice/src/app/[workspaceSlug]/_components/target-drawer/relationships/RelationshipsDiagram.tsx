"use client";

import type {
  EdgeProps,
  EdgeTypes,
  NodeProps,
  NodeTypes,
  ReactFlowInstance,
} from "reactflow";
import { useCallback, useEffect, useState } from "react";
import { SiKubernetes, SiTerraform } from "@icons-pack/react-simple-icons";
import { IconTarget } from "@tabler/icons-react";
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
import { api } from "~/trpc/react";

type TargetNodeProps = NodeProps<{
  name: string;
  label: string;
  id: string;
  kind: string;
  version: string;
}>;
const TargetNode: React.FC<TargetNodeProps> = (node) => {
  const { data } = node;

  const isKubernetes = data.version.includes("kubernetes");
  const isTerraform = data.version.includes("terraform");

  return (
    <>
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center",
          "w-[250px] gap-2 rounded-md border bg-neutral-900 px-4 py-3",
          isKubernetes && "border-blue-500/70 bg-blue-500/20",
          isTerraform && "border-purple-500/70 bg-purple-500/20",
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full">
          {isKubernetes ? (
            <SiKubernetes className="h-8 w-8 text-blue-500" />
          ) : isTerraform ? (
            <SiTerraform className="h-8 w-8 text-purple-300" />
          ) : (
            <IconTarget className="h-8 w-8 text-neutral-500" />
          )}
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
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Right}
      />
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const useOnLayout = () => {
  const { getNodes, fitView, setNodes, setEdges, getEdges } = useReactFlow();
  return useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      "LR",
      100,
    );
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    window.requestAnimationFrame(() => {
      // hack to get it to center - we should figure out when the layout is done
      // and then call fitView. We are betting that everything should be
      // rendered correctly in 100ms before fitting the view.
      sleep(100).then(() => fitView({ padding: 0.12, maxZoom: 1 }));
    });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
};

const TargetDiagram: React.FC<{
  targets: Array<{
    id: string;
    workpace_id: string;
    name: string;
    identifier: string;
    level: number;
    parent_identifier?: string;
    parent_workspace_id?: string;
  }>;
}> = ({ targets }) => {
  const [nodes, _, onNodesChange] = useNodesState(
    targets.map((d) => ({
      id: `${d.workpace_id}-${d.identifier}`,
      type: "target",
      position: { x: 0, y: 0 },
      data: { ...d, label: d.name },
    })),
  );
  const [edges, __, onEdgesChange] = useEdgesState(
    targets
      .filter((t) => t.parent_identifier != null)
      .map((t) => {
        return {
          id: `${t.id}-${t.parent_identifier}`,
          source:
            t.level > 0
              ? `${t.workpace_id}-${t.parent_identifier}`
              : `${t.workpace_id}-${t.identifier}`,
          target:
            t.level > 0
              ? `${t.workpace_id}-${t.identifier}`
              : `${t.workpace_id}-${t.parent_identifier}`,
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
  return (
    <ReactFlowProvider>
      <TargetDiagram targets={hierarchy.data} />
    </ReactFlowProvider>
  );
};
