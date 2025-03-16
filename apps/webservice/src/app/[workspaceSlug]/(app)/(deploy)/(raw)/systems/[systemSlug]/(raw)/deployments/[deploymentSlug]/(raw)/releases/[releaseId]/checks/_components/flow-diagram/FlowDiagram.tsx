"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeTypes } from "reactflow";
import ReactFlow, { useEdgesState, useNodesState } from "reactflow";

import { ArrowEdge } from "~/app/[workspaceSlug]/(app)/_components/reactflow/ArrowEdge";
import {
  createEdgesFromPolicyDeployment,
  createEdgesFromPolicyToEnvironment,
  createEdgesWherePolicyHasNoEnvironment,
} from "~/app/[workspaceSlug]/(app)/_components/reactflow/edges";
import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { EnvironmentNode } from "./EnvironmentNode";
import { PolicyNode } from "./FlowPolicyNode";
import { TriggerNode } from "./TriggerNode";

const nodeTypes: NodeTypes = {
  environment: EnvironmentNode,
  policy: PolicyNode,
  trigger: TriggerNode,
};
export const FlowDiagram: React.FC<{
  workspace: SCHEMA.Workspace;
  systemId: string;
  release: SCHEMA.DeploymentVersion;
  envs: Array<SCHEMA.Environment>;
  policies: Array<SCHEMA.EnvironmentPolicy>;
  policyDeployments: Array<SCHEMA.EnvironmentPolicyDeployment>;
}> = ({ workspace, release, envs, policies, policyDeployments }) => {
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>([
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { ...release, label: release.name },
    },
    ...policies.map((policy) => ({
      id: policy.id,
      type: "policy",
      position: { x: 0, y: 0 },
      data: {
        ...policy,
        policyDeployments: policyDeployments.filter(
          (p) => p.policyId === policy.id,
        ),
        label: policy.name,
        release,
      },
    })),
    ...envs.map((env) => {
      const policy = policies.find((p) => p.id === env.policyId);
      return {
        id: env.id,
        type: "environment",
        position: { x: 0, y: 0 },
        data: {
          workspaceId: workspace.id,
          releaseId: release.id,
          releaseVersion: release.version,
          deploymentId: release.deploymentId,
          environmentId: env.id,
          environmentName: env.name,
          policy,
          label: env.name,
        },
      };
    }),
  ]);

  const [edges, __, onEdgesChange] = useEdgesState([
    ...createEdgesFromPolicyToEnvironment(envs),
    ...createEdgesWherePolicyHasNoEnvironment(policies, policyDeployments),
    ...createEdgesFromPolicyDeployment(policyDeployments),
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
