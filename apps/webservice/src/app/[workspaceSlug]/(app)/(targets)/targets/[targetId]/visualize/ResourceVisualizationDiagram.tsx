"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import ReactFlow, {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { useElkLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/elk";
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

  // const setReactFlowInstance = useLayoutAndFitView(nodes, { direction: "TB" });
  const setReactFlowInstance = useElkLayoutAndFitView(nodes, edges);

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
