"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { EdgeTypes, NodeTypes, ReactFlowInstance } from "reactflow";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import colors from "tailwindcss/colors";

import { Card } from "@ctrlplane/ui/card";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { getLayoutedElementsDagre } from "~/app/[workspaceSlug]/_components/reactflow/layout";
import { DepEdge } from "~/app/[workspaceSlug]/_components/relationships/DepEdge";
import { TargetNode } from "~/app/[workspaceSlug]/_components/relationships/TargetNode";

const nodeTypes: NodeTypes = { target: TargetNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const useOnLayout = () => {
  const { getNodes, fitView, setNodes, setEdges, getEdges } = useReactFlow();
  return useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      "BT",
      200,
      50,
    );
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    fitView({ padding: 0.12, maxZoom: 1 });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
};

const getDFSPath = (
  startId: string,
  goalId: string,
  graph: Record<string, string[]>,
  visited: Set<string> = new Set(),
  path: string[] = [],
): string[] | null => {
  if (startId === goalId) return path;
  visited.add(startId);

  for (const neighbor of graph[startId] ?? []) {
    if (visited.has(neighbor)) continue;
    path.push(neighbor);
    const result = getDFSPath(neighbor, goalId, graph, visited, path);
    if (result !== null) return result;
    path.pop();
  }

  return null;
};

const getUndirectedGraph = (
  relationships: Array<schema.TargetRelationship>,
) => {
  const graph: Record<string, Set<string>> = {};

  for (const relationship of relationships) {
    if (!graph[relationship.sourceId]) graph[relationship.sourceId] = new Set();
    if (!graph[relationship.targetId]) graph[relationship.targetId] = new Set();
    graph[relationship.sourceId]!.add(relationship.targetId);
    graph[relationship.targetId]!.add(relationship.sourceId);
  }
  return Object.fromEntries(
    Object.entries(graph).map(([key, value]) => [key, Array.from(value)]),
  );
};

type DependenciesDiagramProps = {
  targetId: string;
  relationships: Array<schema.TargetRelationship>;
  targets: Array<schema.Target>;
  releaseDependencies: (schema.ReleaseDependency & {
    deploymentName: string;
    target?: string;
  })[];
};

const TargetDiagramDependencies: React.FC<DependenciesDiagramProps> = ({
  targetId,
  relationships,
  targets,
  releaseDependencies,
}) => {
  const [nodes, _, onNodesChange] = useNodesState(
    targets.map((t) => ({
      id: t.id,
      type: "target",
      position: { x: 100, y: 100 },
      data: {
        ...t,
        targetId,
        isOrphanNode: !relationships.some(
          (r) => r.targetId === t.id || r.sourceId === t.id,
        ),
      },
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    relationships.map((t) => ({
      id: `${t.sourceId}-${t.targetId}`,
      source: t.sourceId,
      target: t.targetId,
      markerEnd: {
        type: MarkerType.Arrow,
        color: colors.neutral[700],
      },
      style: {
        stroke: colors.neutral[700],
      },
      label: t.type,
    })),
  );
  const onLayout = useOnLayout();

  const graph = getUndirectedGraph(relationships);

  const resetEdges = () =>
    setEdges(
      relationships.map((t) => ({
        id: `${t.sourceId}-${t.targetId}`,
        source: t.sourceId,
        target: t.targetId,
        markerEnd: {
          type: MarkerType.Arrow,
          color: colors.neutral[700],
        },
        style: {
          stroke: colors.neutral[700],
        },
        label: t.type,
      })),
    );

  const getHighlightedEdgesFromPath = (path: string[]) => {
    const highlightedEdges: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      highlightedEdges.push(`${path[i]}-${path[i + 1]}`);
      highlightedEdges.push(`${path[i + 1]}-${path[i]}`);
    }
    return highlightedEdges;
  };

  const onDependencySelect = (value: string) => {
    const goalId = releaseDependencies.find((rd) => rd.id === value)?.target;
    if (goalId == null) {
      resetEdges();
      return;
    }
    const nodesInPath = getDFSPath(targetId, goalId, graph, new Set(), [
      targetId,
    ]);
    if (nodesInPath == null) {
      resetEdges();
      return;
    }
    const highlightedEdges = getHighlightedEdgesFromPath(nodesInPath);
    const newEdges = relationships.map((t) => {
      const isHighlighted = highlightedEdges.includes(
        `${t.sourceId}-${t.targetId}`,
      );
      const color = isHighlighted ? colors.blue[500] : colors.neutral[700];

      return {
        id: `${t.sourceId}-${t.targetId}`,
        source: t.sourceId,
        target: t.targetId,
        markerEnd: { type: MarkerType.Arrow, color },
        style: { stroke: color },
        label: t.type,
      };
    });
    setEdges(newEdges);
  };

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);
  return (
    <div className="relative h-full w-full">
      <div className="absolute left-2 top-2 z-10">
        <Select onValueChange={onDependencySelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select a dependency" />
          </SelectTrigger>
          <SelectContent>
            {releaseDependencies.map((rd) => (
              <SelectItem key={rd.id} value={rd.id}>
                {rd.deploymentName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
    </div>
  );
};

export const DependenciesDiagram: React.FC<DependenciesDiagramProps> = (
  props,
) => (
  <div className="h-full w-full space-y-2">
    <Label>Release dependencies</Label>
    <Card className="h-[90%] min-h-[500px]">
      <ReactFlowProvider>
        <TargetDiagramDependencies {...props} />
      </ReactFlowProvider>
    </Card>
  </div>
);
