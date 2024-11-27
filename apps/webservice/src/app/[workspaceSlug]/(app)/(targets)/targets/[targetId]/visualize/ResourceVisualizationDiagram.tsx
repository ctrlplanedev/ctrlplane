"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import ReactFlow, {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { edgeTypes, getEdges } from "./edges";
import { getNodes, nodeTypes } from "./nodes/nodes";

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

type ResourceVisualizationDiagramProps = {
  relationships: Relationships;
};

export const ResourceVisualizationDiagram: React.FC<
  ResourceVisualizationDiagramProps
> = ({ relationships }) => {
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>(
    getNodes(relationships),
  );

  const [edges, __, onEdgesChange] = useEdgesState(getEdges(relationships));

  const setReactFlowInstance = useLayoutAndFitView(nodes, {
    direction: "LR",
    extraEdgeLength: 50,
  });

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

export const ResourceVisualizationDiagramProvider: React.FC<
  ResourceVisualizationDiagramProps
> = (props) => (
  <ReactFlowProvider>
    <ResourceVisualizationDiagram {...props} />
  </ReactFlowProvider>
);
