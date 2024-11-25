"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { EdgeTypes, NodeTypes } from "reactflow";
import React from "react";
import { compact } from "lodash";
import ReactFlow, {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { DepEdge } from "./DepEdge";
import {
  createEdgeFromProviderToResource,
  createEdgesFromResourceToEnvironments,
} from "./edges";
import { EnvironmentNode } from "./nodes/EnvironmentNode";
import { ProviderNode } from "./nodes/ProviderNode";
import { ResourceNode } from "./nodes/ResourceNode";

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

type ResourceVisualizationDiagramProps = {
  resource: SCHEMA.Resource;
  relationships: Relationships;
};

enum NodeType {
  Resource = "resource",
  Environment = "environment",
  Provider = "provider",
}

const nodeTypes: NodeTypes = {
  [NodeType.Resource]: ResourceNode,
  [NodeType.Environment]: EnvironmentNode,
  [NodeType.Provider]: ProviderNode,
};
const edgeTypes: EdgeTypes = { default: DepEdge };

export const ResourceVisualizationDiagram: React.FC<
  ResourceVisualizationDiagramProps
> = ({ resource, relationships }) => {
  const { workspace, provider } = relationships;
  const { systems } = workspace;
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>(
    compact([
      {
        id: resource.id,
        type: NodeType.Resource,
        data: { ...resource, label: resource.identifier },
        position: { x: 0, y: 0 },
      },
      ...systems.flatMap((system) =>
        system.environments.map((env) => ({
          id: env.id,
          type: NodeType.Environment,
          data: {
            environment: {
              ...env,
              deployments: system.deployments,
              resource,
            },
            label: `${system.name}/${env.name}`,
          },
          position: { x: 0, y: 0 },
        })),
      ),
      provider != null && {
        id: provider.id,
        type: NodeType.Provider,
        data: { ...provider, label: provider.name },
        position: { x: 0, y: 0 },
      },
    ]),
  );

  const resourceToEnvEdges = createEdgesFromResourceToEnvironments(
    resource,
    systems.flatMap((s) => s.environments),
  );
  const providerEdge = createEdgeFromProviderToResource(provider, resource);

  const [edges, __, onEdgesChange] = useEdgesState(
    compact([...resourceToEnvEdges, providerEdge]),
  );

  const setReactFlowInstance = useLayoutAndFitView(nodes, { direction: "LR" });

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
