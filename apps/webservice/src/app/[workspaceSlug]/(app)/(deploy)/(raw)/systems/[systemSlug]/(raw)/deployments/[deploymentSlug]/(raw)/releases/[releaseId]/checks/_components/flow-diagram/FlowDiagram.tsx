"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeTypes } from "reactflow";
import ReactFlow, { MarkerType, useEdgesState, useNodesState } from "reactflow";
import colors from "tailwindcss/colors";

import { ArrowEdge } from "~/app/[workspaceSlug]/(app)/_components/reactflow/ArrowEdge";
import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { EnvironmentNode } from "./nodes/EnvironmentNode";
import { TriggerNode } from "./nodes/TriggerNode";

const nodeTypes: NodeTypes = {
  environment: EnvironmentNode,
  trigger: TriggerNode,
};

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

export const FlowDiagram: React.FC<{
  workspace: SCHEMA.Workspace;
  deploymentVersion: SCHEMA.DeploymentVersion;
  envs: Array<SCHEMA.Environment>;
}> = ({ workspace, deploymentVersion, envs }) => {
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>([
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { ...deploymentVersion, label: deploymentVersion.name },
    },
    ...envs.map((env) => {
      return {
        id: env.id,
        type: "environment",
        position: { x: 0, y: 0 },
        data: {
          workspaceId: workspace.id,
          versionId: deploymentVersion.id,
          versionTag: deploymentVersion.tag,
          deploymentId: deploymentVersion.deploymentId,
          environmentId: env.id,
          environmentName: env.name,
          label: env.name,
        },
      };
    }),
  ]);

  const [edges, __, onEdgesChange] = useEdgesState([
    ...envs.map((env) => ({
      id: env.id,
      source: "trigger",
      target: env.id,
      markerEnd,
    })),
  ]);

  const { setReactFlowInstance } = useLayoutAndFitView(nodes, {
    direction: "LR",
    padding: 0.16,
  });

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={setReactFlowInstance}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      edgeTypes={{ default: ArrowEdge }}
      fitView
      proOptions={{ hideAttribution: true }}
    />
  );
};
