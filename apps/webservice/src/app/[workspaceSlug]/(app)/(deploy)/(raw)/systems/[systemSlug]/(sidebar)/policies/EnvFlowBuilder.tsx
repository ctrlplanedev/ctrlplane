"use client";

import type {
  Environment,
  EnvironmentPolicy,
  EnvironmentPolicyDeployment,
} from "@ctrlplane/db/schema";
import type { Connection, Node, OnConnect } from "reactflow";
import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMount } from "react-use";
import ReactFlow, {
  addEdge,
  getOutgoers,
  MarkerType,
  Panel,
  useEdgesState,
  useKeyPress,
  useNodesState,
  useReactFlow,
} from "reactflow";
import colors from "tailwindcss/colors";
import { isPresent } from "ts-is-present";

import { useEnvironmentDrawer } from "~/app/[workspaceSlug]/(app)/_components/environment/drawer/EnvironmentDrawer";
import { useEnvironmentPolicyDrawer } from "~/app/[workspaceSlug]/(app)/_components/policy/drawer/EnvironmentPolicyDrawer";
import { ArrowEdge } from "~/app/[workspaceSlug]/(app)/_components/reactflow/ArrowEdge";
import {
  createEdgesFromPolicyDeployment,
  createEdgesWhereEnvironmentHasNoPolicy,
  createEdgesWherePolicyHasNoEnvironment,
} from "~/app/[workspaceSlug]/(app)/_components/reactflow/edges";
import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { api } from "~/trpc/react";
import { useDeleteNodeDialog } from "./DeleteNodeDialog";
import { useHandleEdgeDelete, useOnEdgeClick } from "./edges";
import { EnvFlowPanel } from "./EnvFlowPanel";
import { NodeType, nodeTypes } from "./FlowNodeTypes";
import { usePanel } from "./SidepanelContext";

const triggerNode = {
  id: "trigger",
  type: "trigger",
  position: { x: 0, y: 0 },
  data: { label: "On new version" },
};

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

const useValidConnection = () => {
  const { getNodes, getEdges, getNode } = useReactFlow();

  return useCallback(
    (connection: Connection) => {
      // we are using getNodes and getEdges helpers here
      // to make sure we create isValidConnection function only once
      const nodes = getNodes();
      const edges = getEdges();
      const source = getNode(connection.source ?? "");
      const target = getNode(connection.target ?? "");
      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === connection.source) return true;
          if (hasCycle(outgoer, visited)) return true;
        }
      };

      if (target == null) return false;
      if (source == null) return false;
      if (target.id === connection.source) return false;
      if (hasCycle(target)) return false;
      if (
        target.type === NodeType.Environment &&
        source.type === NodeType.Environment
      )
        return false;
      if (target.type === NodeType.Policy && source.type === NodeType.Policy)
        return false;

      return true;
    },
    [getNodes, getEdges, getNode],
  );
};

const useOnConnect = () => {
  const { setEdges, getNode } = useReactFlow();
  const env = api.environment.update.useMutation();
  const policyDeployment =
    api.environment.policy.deployment.create.useMutation();
  const onConnect = useCallback<OnConnect>(
    (params: Connection) => {
      if (!isPresent(params.source) || !isPresent(params.target)) return;
      const source = getNode(params.source);
      const target = getNode(params.target);

      const isSettingEnvironmentPolicy =
        source?.type === NodeType.Policy &&
        target?.type === NodeType.Environment;
      if (isSettingEnvironmentPolicy) {
        env.mutate({ id: target.id, data: { policyId: source.id } });
        setEdges((eds) =>
          addEdge(
            { ...params, markerEnd },
            // Remove all other references to the environment
            eds.filter((e) => e.target !== target.id),
          ),
        );
        return;
      }

      const isSettingEnvironmentPolicyToTrigger =
        source?.type === NodeType.Trigger &&
        target?.type === NodeType.Environment;
      if (isSettingEnvironmentPolicyToTrigger) {
        env.mutate({ id: target.id, data: { policyId: null } });
        setEdges((eds) =>
          addEdge(
            { ...params, markerEnd },
            // Remove all other references to the environment
            eds.filter((e) => e.target !== target.id),
          ),
        );
        return;
      }

      const isSettingEnvironmentPolicyEnvironment =
        source?.type === NodeType.Environment &&
        target?.type === NodeType.Policy;

      if (isSettingEnvironmentPolicyEnvironment) {
        policyDeployment.mutate({
          environmentId: source.id,
          policyId: target.id,
        });
        setEdges((eds) =>
          addEdge(
            { ...params, markerEnd },
            // Remove all other references to the environment
            eds.filter((e) => e.target !== target.id || e.source !== "trigger"),
          ),
        );
        return;
      }

      setEdges((eds) => addEdge(params, eds));

      // const isSettingPolicyDeployment =
      //   source?.type === NodeType.Environment &&
      //   target?.type === NodeType.Policy;
      // if (isSettingEnvironmentPolicy)
      //   policy.mutate({ id: target.id, data: { policyId: source.id } });
    },
    [getNode, setEdges, env, policyDeployment],
  );
  return onConnect;
};

export const EnvFlowBuilder: React.FC<{
  systemId: string;
  envs: Array<Environment>;
  policies: Array<EnvironmentPolicy>;
  policyDeployments: Array<EnvironmentPolicyDeployment>;
}> = ({ systemId, envs, policies, policyDeployments }) => {
  const standalonePolicies = policies.filter((p) => p.environmentId == null);
  const [nodes, _, onNodesChange] = useNodesState([
    triggerNode,
    ...envs.map((env) => ({
      id: env.id,
      type: NodeType.Environment,
      position: { x: 0, y: 0 },
      data: { ...env, label: env.name },
    })),
    ...standalonePolicies.map((policy) => ({
      id: policy.id,
      type: NodeType.Policy,
      position: { x: 0, y: 0 },
      data: { ...policy, label: policy.name },
    })),
  ]);

  const {
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
  } = usePanel();
  const searchParams = useSearchParams();
  useMount(() => {
    const selected = searchParams.get("selected");
    if (selected != null) setSelectedNodeId(selected);
  });

  const [edges, __, onEdgesChange] = useEdgesState([
    ...createEdgesWhereEnvironmentHasNoPolicy(envs, standalonePolicies),
    ...createEdgesWherePolicyHasNoEnvironment(
      standalonePolicies,
      policyDeployments,
    ),
    ...createEdgesFromPolicyDeployment(policyDeployments),
  ]);

  const isValidConnection = useValidConnection();

  const onConnect = useOnConnect();

  const { setReactFlowInstance, onLayout } = useLayoutAndFitView(nodes);

  const onEdgeClick = useOnEdgeClick();

  const deletePressed = useKeyPress(["Delete", "Backspace"]);
  const handleEdgeDelete = useHandleEdgeDelete();
  const { setOpen } = useDeleteNodeDialog();

  useEffect(() => {
    if (!deletePressed) return;
    if (selectedNodeId != null) {
      setOpen(true);
      return;
    }
    if (selectedEdgeId == null) return;

    const edge = edges.find((e) => e.id === selectedEdgeId);
    if (edge == null) return;
    handleEdgeDelete(edge);
  }, [
    edges,
    deletePressed,
    selectedNodeId,
    selectedEdgeId,
    handleEdgeDelete,
    setOpen,
  ]);

  const { setEnvironmentId } = useEnvironmentDrawer();
  const { setEnvironmentPolicyId } = useEnvironmentPolicyDrawer();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges.map((e) => ({
        ...e,
        animated: selectedEdgeId === e.id,
        style: { stroke: colors.neutral[700] },
      }))}
      onInit={setReactFlowInstance}
      nodeTypes={nodeTypes}
      edgeTypes={{ default: ArrowEdge }}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      fitView
      nodesDraggable
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => {
        if (node.type === NodeType.Environment) setEnvironmentId(node.id);
        if (node.type === NodeType.Policy) setEnvironmentPolicyId(node.id);
        setSelectedNodeId(node.id);
      }}
      onEdgeClick={(_, edge) => {
        onEdgeClick(edge);
      }}
      onPaneClick={() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }}
      deleteKeyCode={[]}
    >
      <Panel position={"bottom-center"} className="flex items-center gap-4">
        <EnvFlowPanel onLayout={onLayout} systemId={systemId} />
      </Panel>
    </ReactFlow>
  );
};
