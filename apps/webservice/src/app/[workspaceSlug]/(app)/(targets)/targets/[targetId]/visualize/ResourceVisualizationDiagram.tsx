"use client";

import type { RouterOutputs } from "@ctrlplane/api";
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
  createEdgesFromDeploymentsToResources,
  createEdgesFromResourceToEnvironments,
} from "./edges";
import { EnvironmentNode } from "./nodes/EnvironmentNode";
import { ProviderNode } from "./nodes/ProviderNode";
import { ResourceNode } from "./nodes/ResourceNode";

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

type ResourceVisualizationDiagramProps = {
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
> = ({ relationships }) => {
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>(
    compact([
      ...relationships.map((r) => ({
        id: r.id,
        type: NodeType.Resource,
        data: { ...r, label: r.identifier },
        position: { x: 0, y: 0 },
      })),
      ...relationships.flatMap((r) =>
        r.provider != null
          ? [
              {
                id: `${r.provider.id}-${r.id}`,
                type: NodeType.Provider,
                data: { ...r.provider, label: r.provider.name },
                position: { x: 0, y: 0 },
              },
            ]
          : [],
      ),
      ...relationships.flatMap((r) =>
        r.workspace.systems.flatMap((s) =>
          s.environments.map((e) => ({
            id: e.id,
            type: NodeType.Environment,
            data: {
              environment: {
                ...e,
                deployments: s.deployments,
                resource: r,
              },
              label: `${s.name}/${e.name}`,
            },
            position: { x: 0, y: 0 },
          })),
        ),
      ),
    ]),
  );

  const resourceToEnvEdges = relationships.flatMap((r) =>
    createEdgesFromResourceToEnvironments(
      r,
      r.workspace.systems.flatMap((s) => s.environments),
    ),
  );
  const providerEdges = relationships.flatMap((r) =>
    r.provider != null ? [createEdgeFromProviderToResource(r.provider, r)] : [],
  );
  const deploymentEdges = createEdgesFromDeploymentsToResources(relationships);
  const [edges, __, onEdgesChange] = useEdgesState(
    compact([...resourceToEnvEdges, ...providerEdges, ...deploymentEdges]),
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
