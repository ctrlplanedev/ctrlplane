"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type {
  EdgeTypes,
  NodeMouseHandler,
  NodeTypes,
  ReactFlowInstance,
} from "reactflow";
import React, { useCallback, useEffect, useState } from "react";
import { compact } from "lodash";
import ReactFlow, {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";

import { getLayoutedElementsDagre } from "~/app/[workspaceSlug]/_components/reactflow/layout";
import { DepEdge } from "./DepEdge";
import {
  createEdgeFromProviderToResource,
  createEdgesFromEnvironmentsToSystems,
  createEdgesFromResourceToEnvironments,
  createEdgesFromSystemsToDeployments,
} from "./edges";
import { DeploymentNode } from "./nodes/DeploymentNode";
import { EnvironmentNode } from "./nodes/EnvironmentNode";
import { ProviderNode } from "./nodes/ProviderNode";
import { ResourceNode } from "./nodes/ResourceNode";
import { SystemNode } from "./nodes/SystemNode";

type Relationships = NonNullable<RouterOutputs["resource"]["relationships"]>;

type ResourceVisualizationDiagramProps = {
  resource: SCHEMA.Resource;
  relationships: Relationships;
};

enum NodeType {
  Resource = "resource",
  Environment = "environment",
  Provider = "provider",
  System = "system",
  Deployment = "deployment",
}

const nodeTypes: NodeTypes = {
  [NodeType.Resource]: ResourceNode,
  [NodeType.Environment]: EnvironmentNode,
  [NodeType.Provider]: ProviderNode,
  [NodeType.System]: SystemNode,
  [NodeType.Deployment]: DeploymentNode,
};
const edgeTypes: EdgeTypes = { default: DepEdge };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

    window.requestAnimationFrame(() => {
      // hack to get it to center - we should figure out when the layout is done
      // and then call fitView. We are betting that everything should be
      // rendered correctly in 100ms before fitting the view.
      sleep(100).then(() => fitView({ padding: 0.12, maxZoom: 1 }));
    });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
};

export const ResourceVisualizationDiagram: React.FC<
  ResourceVisualizationDiagramProps
> = ({ resource, relationships }) => {
  const { systems, provider } = relationships;
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
          data: { ...env, label: env.name },
          position: { x: 0, y: 0 },
        })),
      ),
      ...systems.map((system) => ({
        id: system.id,
        type: NodeType.System,
        data: { ...system, label: system.name },
        position: { x: 0, y: 0 },
      })),
      ...systems.flatMap((system) =>
        system.deployments.map((deployment) => ({
          id: deployment.id,
          type: NodeType.Deployment,
          data: { ...deployment, label: deployment.name },
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
  const envToSystemEdges = createEdgesFromEnvironmentsToSystems(systems);
  const systemToDeploymentsEdges = createEdgesFromSystemsToDeployments(systems);
  const providerEdge = createEdgeFromProviderToResource(provider, resource);

  const [edges, __, onEdgesChange] = useEdgesState(
    compact([
      ...resourceToEnvEdges,
      ...envToSystemEdges,
      ...systemToDeploymentsEdges,
      providerEdge,
    ]),
  );
  const onLayout = useOnLayout();

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);

  const onNodeClick: NodeMouseHandler = (event, node) => {
    console.log(node);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
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
