import type { Edge } from "reactflow";
import { MarkerType, useReactFlow } from "reactflow";
import colors from "tailwindcss/colors";

import { api } from "~/trpc/react";
import { NodeType } from "./FlowNodeTypes";
import { usePanel } from "./SidepanelContext";

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[700],
};

export const useOnEdgeClick = () => {
  const { selectedEdgeId, setSelectedEdgeId } = usePanel();

  return (edge: Edge) => {
    if (selectedEdgeId === edge.id) {
      setSelectedEdgeId(null);
      return;
    }
    const { source } = edge;
    if (source === "trigger") return;

    setSelectedEdgeId(edge.id);
  };
};

export const useHandleEdgeDelete = () => {
  const { getEdges, setEdges, getNode } = useReactFlow();
  const { setSelectedEdgeId } = usePanel();
  const env = api.environment.update.useMutation();
  const policyDeploymentDelete =
    api.environment.policy.deployment.delete.useMutation();

  return (edge: Edge) => {
    const { source, target } = edge;
    if (source === "trigger") return;

    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    const edges = getEdges().filter(
      (e) => e.target !== target || e.source !== source,
    );
    if (!edges.some((e) => e.target === target))
      edges.push({
        id: "trigger-" + target,
        source: "trigger",
        target,
        markerEnd,
      });

    const isDetachingPolicyFromEnvironment =
      sourceNode?.type === NodeType.Policy &&
      targetNode?.type === NodeType.Environment;
    if (isDetachingPolicyFromEnvironment) {
      env.mutate({ id: target, data: { policyId: null } });
      setEdges(edges);
      setSelectedEdgeId(null);
      return;
    }

    const isDetachingEnvironmentFromPolicy =
      sourceNode?.type === NodeType.Environment &&
      targetNode?.type === NodeType.Policy;

    if (!isDetachingEnvironmentFromPolicy) return;

    policyDeploymentDelete.mutate({
      environmentId: source,
      policyId: target,
    });

    setEdges(edges);
    setSelectedEdgeId(null);
  };
};
