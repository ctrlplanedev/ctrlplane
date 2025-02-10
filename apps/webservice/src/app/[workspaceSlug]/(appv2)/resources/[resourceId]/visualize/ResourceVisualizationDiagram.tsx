"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import { IconLoader2, IconNetworkOff } from "@tabler/icons-react";
import ReactFlow, {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(appv2)/_components/reactflow/layout";
import { api } from "~/trpc/react";
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

  const { setReactFlowInstance } = useLayoutAndFitView(nodes, {
    direction: "LR",
    extraEdgeLength: 50,
    focusedNodeId: relationships.resource.id,
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

type ResourceVisualizationDiagramProviderProps = {
  resourceId: string;
};

export const ResourceVisualizationDiagramProvider: React.FC<
  ResourceVisualizationDiagramProviderProps
> = ({ resourceId }) => {
  const { data: relationships, isLoading } =
    api.resource.relationships.useQuery(resourceId, {
      refetchInterval: 60_000,
    });

  if (isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <IconLoader2 className="animate-spin" />
      </div>
    );

  if (!relationships)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <IconNetworkOff className="h-4 w-4" /> No relationships found
      </div>
    );

  return (
    <ReactFlowProvider>
      <ResourceVisualizationDiagram relationships={relationships} />
    </ReactFlowProvider>
  );
};
