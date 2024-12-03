"use client";

import type { Edge, Node, ReactFlowInstance } from "reactflow";
import { useCallback, useEffect, useState } from "react";
import dagre from "dagre";
import { useReactFlow } from "reactflow";

const generateLevels = (nodes: Node[], edges: Edge[]) => {
  const levels: Record<string, number> = {};
  const edgeMap: Record<string, string[]> = {};

  edges.forEach((edge) => {
    if (!edgeMap[edge.target]) edgeMap[edge.target] = [];
    edgeMap[edge.target]!.push(edge.source);
  });

  const calculateLevel = (nodeId: string): number => {
    if (levels[nodeId] !== undefined) return levels[nodeId];

    const sources = edgeMap[nodeId] ?? [];
    if (sources.length === 0) {
      levels[nodeId] = 0;
      return 0;
    }
    const maxSourceLevel = Math.max(...sources.map(calculateLevel));
    levels[nodeId] = maxSourceLevel + 1;

    return levels[nodeId];
  };

  nodes.forEach((node) => calculateLevel(node.id));

  return levels;
};

export const getLayoutedElementsDagre = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
  extraEdgeLength = 0,
  nodesep = 50,
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep });

  nodes.forEach((node) => dagreGraph.setNode(node.id, node));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  const levels = generateLevels(nodes, edges);

  return {
    nodes: nodes.map((node) => {
      const position = dagreGraph.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x =
        position.x - (node.width ?? 0) / 2 + extraEdgeLength * levels[node.id]!;
      const y = position.y - (node.height ?? 0) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

type LayoutConfig = {
  direction?: "TB" | "LR" | "BT" | "RL";
  extraEdgeLength?: number;
  nodesep?: number;
  padding?: number;
  maxZoom?: number;
  focusedNodeId?: string;
};

export const useLayoutAndFitView = (nodes: Node[], config?: LayoutConfig) => {
  const [isLayouted, setIsLayouted] = useState(false);
  const [isViewFitted, setIsViewFitted] = useState(false);

  const { getNodes, setNodes, setEdges, getEdges } = useReactFlow();

  const onLayout = useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      config?.direction,
      config?.extraEdgeLength,
      config?.nodesep,
    );
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    setIsLayouted(true);
  }, [getNodes, getEdges, setNodes, setEdges, setIsLayouted, config]);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);

  const setDefaultView = useCallback(() => {
    reactFlowInstance?.fitView({
      padding: config?.padding ?? 0.12,
      maxZoom: config?.maxZoom ?? 1,
    });
    setIsViewFitted(true);
  }, [reactFlowInstance, config]);

  useEffect(() => {
    if (
      reactFlowInstance != null &&
      nodes.length &&
      isLayouted &&
      !isViewFitted
    ) {
      if (config?.focusedNodeId == null) {
        setDefaultView();
        return;
      }

      const focusedNode = nodes.find((n) => n.id === config.focusedNodeId);
      if (focusedNode == null) {
        setDefaultView();
        return;
      }

      reactFlowInstance.fitView({
        padding: config.padding ?? 0.12,
        maxZoom: config.maxZoom ?? 2,
      });
      reactFlowInstance.setCenter(
        focusedNode.position.x + 100,
        focusedNode.position.y + 100,
        { zoom: 1.5, duration: 500 },
      );
      setIsViewFitted(true);
    }
  }, [
    reactFlowInstance,
    nodes,
    isLayouted,
    isViewFitted,
    config,
    setDefaultView,
  ]);

  return setReactFlowInstance;
};
