"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { CSSProperties } from "react";
import type {
  EdgeProps,
  EdgeTypes,
  NodeProps,
  NodeTypes,
  ReactFlowInstance,
} from "reactflow";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { getLayoutedElementsDagre } from "~/app/[workspaceSlug]/_components/reactflow/layout";
import { TargetIcon } from "~/app/[workspaceSlug]/_components/TargetIcon";

const getAnimatedBorderColor = (version: string, kind?: string): string => {
  if (version.includes("kubernetes")) return "#3b82f6";
  if (version.includes("terraform")) return "#8b5cf6";
  if (kind?.toLowerCase().includes("sharedcluster")) return "#3b82f6";
  return "#a3a3a3";
};

type TargetNodeProps = NodeProps<{
  name: string;
  label: string;
  id: string;
  kind: string;
  version: string;
  targetId: string;
}>;
const TargetNode: React.FC<TargetNodeProps> = (node) => {
  const { data } = node;

  const isKubernetes = data.version.includes("kubernetes");
  const isTerraform = data.version.includes("terraform");
  const isSharedCluster = data.kind.toLowerCase().includes("sharedcluster");
  const isSelected = data.id === data.targetId;

  const animatedBorderColor = getAnimatedBorderColor(data.version, data.kind);

  const selectedStyle: CSSProperties | undefined = isSelected
    ? {
        position: "relative",
        borderColor: "transparent",
        backgroundClip: "padding-box",
      }
    : undefined;

  return (
    <>
      <div
        className={cn(
          "flex flex-col",
          "w-[250px] gap-2 rounded-md border bg-neutral-900 px-4 py-3",
          isKubernetes && "border-blue-500/70 bg-blue-500/20",
          isTerraform && "border-purple-500/70 bg-purple-500/20",
          isSharedCluster && "border-blue-500/70 bg-blue-500/20",
        )}
        style={selectedStyle}
      >
        {isSelected && <div className="animated-border" />}
        <div className="flex items-center gap-2">
          <TargetIcon version={data.version} kind={data.kind} />
          <span className="text-xs">{data.kind}</span>
        </div>
        <div className="text-sm">{data.name}</div>
      </div>

      <Handle
        type="target"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-500",
          isKubernetes && "border-blue-500/70",
          isTerraform && "border-purple-500/70",
          isSharedCluster && "border-blue-500/70",
        )}
        style={{ background: colors.neutral[800] }}
        position={Position.Bottom}
      />
      <Handle
        type="source"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-500",
          isKubernetes && "border-blue-500/70",
          isTerraform && "border-purple-500/70",
          isSharedCluster && "border-blue-500/70",
        )}
        style={{ background: colors.neutral[800] }}
        position={Position.Top}
      />
      <style jsx>{`
        .animated-border {
          position: absolute;
          top: -1px;
          left: -1px;
          right: -1px;
          bottom: -1px;
          background-image: linear-gradient(
              90deg,
              ${animatedBorderColor} 50%,
              transparent 50%
            ),
            linear-gradient(90deg, ${animatedBorderColor} 50%, transparent 50%),
            linear-gradient(0deg, ${animatedBorderColor} 50%, transparent 50%),
            linear-gradient(0deg, ${animatedBorderColor} 50%, transparent 50%);
          background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
          background-size:
            20px 1px,
            20px 1px,
            1px 20px,
            1px 20px;
          background-position:
            0 0,
            0 100%,
            0 0,
            100% 0;
          border-radius: calc(0.5rem - 2px);
          animation: moveDashedBorder 1s linear infinite;
          pointer-events: none;
        }

        @keyframes moveDashedBorder {
          0% {
            background-position:
              0 0,
              0 100%,
              0 0,
              100% 0;
          }
          100% {
            background-position:
              20px 0,
              -20px 100%,
              0 -20px,
              100% 20px;
          }
        }
      `}</style>
    </>
  );
};

const DepEdge: React.FC<EdgeProps> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerStart={markerEnd}
        style={{ strokeWidth: 2, ...style }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 16,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
          }}
          className="nodrag nopan z-10"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes: NodeTypes = { target: TargetNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const useOnLayout = () => {
  const { getNodes, fitView, setNodes, setEdges, getEdges } = useReactFlow();
  return useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      "BT",
      0,
      50,
    );
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    fitView({ padding: 0.12, maxZoom: 1 });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
};

const getDFSEdges = (
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
    const result = getDFSEdges(neighbor, goalId, graph, visited, [
      ...path,
      neighbor,
    ]);
    if (result !== null) return result;
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

export const TargetDiagramDependencies: React.FC<{
  targetId: string;
  relationships: Array<schema.TargetRelationship>;
  targets: Array<schema.Target>;
  releaseDependencies: (schema.ReleaseDependency & {
    deploymentName: string;
    target?: string;
  })[];
}> = ({ targetId, relationships, targets, releaseDependencies }) => {
  const [nodes, _, onNodesChange] = useNodesState(
    targets.map((t) => ({
      id: t.id,
      type: "target",
      position: { x: 100, y: 100 },
      data: { ...t, targetId },
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    relationships.map((t) => {
      return {
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
      };
    }),
  );
  const onLayout = useOnLayout();

  const graph = getUndirectedGraph(relationships);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);
  return (
    <div className="relative h-full w-full">
      <div className="absolute left-2 top-2 z-10">
        <Select
          onValueChange={(value) => {
            const goalId = releaseDependencies.find(
              (rd) => rd.id === value,
            )?.target;
            if (goalId == null) {
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
                })),
              );
              return;
            }

            const edges = getDFSEdges(targetId, goalId, graph, new Set(), [
              targetId,
            ]);
            const newHighlightedEdges: string[] = [];
            if (edges == null) {
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
                })),
              );
              return;
            }

            for (let i = 0; i < edges.length - 1; i++) {
              newHighlightedEdges.push(`${edges[i]}-${edges[i + 1]}`);
              newHighlightedEdges.push(`${edges[i + 1]}-${edges[i]}`);
            }

            const newEdges = relationships.map((t) => {
              const isHighlighted = newHighlightedEdges.includes(
                `${t.sourceId}-${t.targetId}`,
              );

              return {
                id: `${t.sourceId}-${t.targetId}`,
                source: t.sourceId,
                target: t.targetId,
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: isHighlighted ? colors.blue[500] : colors.neutral[700],
                },
                style: {
                  stroke: isHighlighted
                    ? colors.blue[500]
                    : colors.neutral[700],
                },
              };
            });
            setEdges(newEdges);
          }}
        >
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
