"use client";

import type {
  Environment,
  EnvironmentPolicy,
  EnvironmentPolicyDeployment,
  Release,
} from "@ctrlplane/db/schema";
import type { NodeTypes, ReactFlowInstance } from "reactflow";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";

import { ArrowEdge } from "~/app/[workspaceSlug]/_components/reactflow/ArrowEdge";
import {
  createEdgesFromPolicyDeployment,
  createEdgesFromPolicyToReleaseSequencing,
  createEdgesFromReleaseSequencingToEnvironment,
  createEdgesWherePolicyHasNoEnvironment,
} from "~/app/[workspaceSlug]/_components/reactflow/edges";
import { getLayoutedElementsDagre } from "~/app/[workspaceSlug]/_components/reactflow/layout";
import { EnvironmentNode } from "./FlowNode";
import { PolicyNode } from "./FlowPolicyNode";
import { ReleaseSequencingNode } from "./ReleaseSequencingNode";

const nodeTypes: NodeTypes = {
  environment: EnvironmentNode,
  policy: PolicyNode,
  "release-sequencing": ReleaseSequencingNode,
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const FlowDiagram: React.FC<{
  systemId: string;
  release: Release;
  envs: Array<Environment>;
  policies: Array<EnvironmentPolicy>;
  policyDeployments: Array<EnvironmentPolicyDeployment>;
}> = ({ release, envs, policies, policyDeployments }) => {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<{ label: string }>([
    ...envs.map((env) => ({
      id: env.id,
      type: "environment",
      position: { x: 0, y: 0 },
      data: { ...env, label: env.name, release },
    })),
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
        id: env.id + "-release-sequencing",
        type: "release-sequencing",
        position: { x: 0, y: 0 },
        data: {
          releaseId: release.id,
          deploymentId: release.deploymentId,
          environmentId: env.id,
          policyType: policy?.releaseSequencing,
          label: `${env.name} - release sequencing`,
        },
      };
    }),
  ]);

  const [edges, setEdges, onEdgesChange] = useEdgesState([
    ...createEdgesFromPolicyToReleaseSequencing(envs),
    ...createEdgesFromReleaseSequencingToEnvironment(envs),
    ...createEdgesWherePolicyHasNoEnvironment(policies, policyDeployments),
    ...createEdgesFromPolicyDeployment(policyDeployments),
  ]);

  const { fitView } = useReactFlow();
  const onLayout = useCallback(() => {
    const layouted = getLayoutedElementsDagre(nodes, edges, "LR");

    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    window.requestAnimationFrame(() => {
      // hack to get it to center - we should figure out when the layout is done
      // and then call fitView. We are betting that everything should be
      // rendered correctly in 100ms before fitting the view.
      sleep(100).then(() => fitView({ padding: 0.12, maxZoom: 1 }));
    });
  }, [nodes, edges, setNodes, setEdges, fitView]);

  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);

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
