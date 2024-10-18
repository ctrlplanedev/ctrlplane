"use client";

import type { Edge, Node } from "reactflow";
import dagre from "dagre";

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
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

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
