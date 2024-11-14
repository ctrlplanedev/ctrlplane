"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { EdgeTypes, NodeTypes, ReactFlowInstance } from "reactflow";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import colors from "tailwindcss/colors";

import { getLayoutedElementsDagre } from "~/app/[workspaceSlug]/_components/reactflow/layout";
import { DepEdge } from "~/app/[workspaceSlug]/_components/relationships/DepEdge";
import { TargetNode } from "~/app/[workspaceSlug]/_components/relationships/TargetNode";
import { api } from "~/trpc/react";

const nodeTypes: NodeTypes = { target: TargetNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const useOnLayout = () => {
  const { getNodes, fitView, setNodes, setEdges, getEdges } = useReactFlow();
  return useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      "BT",
      0,
      50,
    );
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    fitView({ padding: 0.12, maxZoom: 1 });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
};

const TargetDiagram: React.FC<{
  relationships: Array<schema.ResourceRelationship>;
  targets: Array<schema.Resource>;
  targetId: string;
}> = ({ relationships, targets, targetId }) => {
  const [nodes, _, onNodesChange] = useNodesState(
    targets.map((t) => ({
      id: t.id,
      type: "target",
      position: { x: 100, y: 100 },
      data: {
        ...t,
        targetId,
        isOrphanNode: !relationships.some(
          (r) => r.targetId === t.id || r.sourceId === t.id,
        ),
      },
    })),
  );
  const [edges, __, onEdgesChange] = useEdgesState(
    relationships.map((t) => ({
      id: `${t.sourceId}-${t.targetId}`,
      source: t.sourceId,
      target: t.targetId,
      markerEnd: { type: MarkerType.Arrow, color: colors.neutral[700] },
      style: { stroke: colors.neutral[700] },
      label: t.type,
    })),
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
  const hierarchy = api.resource.relations.hierarchy.useQuery(targetId);

  if (hierarchy.data == null) return null;
  const { relationships, resources } = hierarchy.data;
  return (
    <ReactFlowProvider>
      <TargetDiagram
        relationships={relationships}
        targets={resources}
        targetId={targetId}
      />
    </ReactFlowProvider>
  );
};
