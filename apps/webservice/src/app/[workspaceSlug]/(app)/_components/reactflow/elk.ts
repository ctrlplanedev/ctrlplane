"use client";

import type { Edge, Node, ReactFlowInstance } from "reactflow";
import { useCallback, useEffect, useState } from "react";
import ELK from "elkjs";
import { Position, useReactFlow } from "reactflow";

const elk = new ELK();

const elkDefaultOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "-150",
  // "elk.layered.spacing.nodeNodeBetweenLayers": "-100",
};

type NodeDimensions = {
  width: number;
  height: number;
};

export const getLayoutedElementsElk = (
  nodes: Node[],
  edges: Edge[],
  elkOptions?: Record<string, string>,
  nodeDimensions?: NodeDimensions,
) => {
  const options = { ...elkDefaultOptions, ...elkOptions };
  const isHorizontal = options["elk.direction"] === "RIGHT";

  const elkGraph = {
    id: "root",
    layoutOptions: options,
    children: nodes.map((node) => ({
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      width: nodeDimensions?.width ?? 500,
      height: nodeDimensions?.height ?? 140,
    })),
    edges: edges.map((edge) => ({
      ...edge,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  return elk
    .layout(elkGraph)
    .then((layoutedGraph) => ({
      nodes: (layoutedGraph.children ?? []).map((node) => ({
        ...node,
        position: { x: node.x ?? 0, y: node.y ?? 0 },
        data: nodes.find((n) => n.id === node.id)?.data,
      })),
      edges: (layoutedGraph.edges ?? []).map((edge) => ({
        ...edge,
        source: edge.sources[0] ?? "",
        target: edge.targets[0] ?? "",
      })),
    }))
    .catch(console.error);
};

type ViewOptions = {
  padding?: number;
  maxZoom?: number;
};

export const useElkLayoutAndFitView = (
  nodes: Node[],
  edges: Edge[],
  elkOptions?: Record<string, string>,
  nodeDimensions?: NodeDimensions,
  viewOptions?: ViewOptions,
) => {
  const [isLayouted, setIsLayouted] = useState(false);
  const [isViewFitted, setIsViewFitted] = useState(false);

  const { getNodes, setNodes, setEdges, getEdges } = useReactFlow();

  const onLayout = useCallback(async () => {
    const layouted = await getLayoutedElementsElk(
      getNodes(),
      getEdges(),
      elkOptions,
      nodeDimensions,
    );
    if (layouted == null) return;
    const { nodes: elkNodes, edges: elkEdges } = layouted;
    setNodes(elkNodes);
    setEdges(elkEdges);
    setIsLayouted(true);
  }, [getNodes, getEdges, setNodes, setEdges, elkOptions, nodeDimensions]);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);

  useEffect(() => {
    if (
      reactFlowInstance != null &&
      nodes.length &&
      isLayouted &&
      !isViewFitted
    ) {
      reactFlowInstance.fitView({
        padding: viewOptions?.padding ?? 0.12,
        maxZoom: viewOptions?.maxZoom ?? 1,
      });
      setIsViewFitted(true);
    }
  }, [reactFlowInstance, nodes, isLayouted, isViewFitted, viewOptions]);

  return setReactFlowInstance;
};
