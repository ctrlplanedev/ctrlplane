"use client";

import type { Deployment, Release } from "@ctrlplane/db/schema";
import type { EdgeProps, NodeProps, ReactFlowInstance } from "reactflow";
import { useCallback, useEffect, useState } from "react";
import { TbSelector } from "react-icons/tb";
import ReactFlow, {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import colors from "tailwindcss/colors";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";
import { getLayoutedElementsDagre } from "../_components/reactflow/layout";

const useOnLayout = () => {
  const { getNodes, fitView, setNodes, setEdges, getEdges } = useReactFlow();
  return useCallback(() => {
    const layouted = getLayoutedElementsDagre(
      getNodes(),
      getEdges(),
      "LR",
      100,
    );
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    window.requestAnimationFrame(() => {
      // hack to get it to center - we should figure out when the layout is done
      // and then call fitView. We are betting that everything should be
      // rendered correctly in 100ms before fitting the view.
      sleep(100).then(() => fitView({ padding: 0.12, maxZoom: 1 }));
    });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);
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
        markerEnd={markerEnd}
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

const ReleaseSelector: React.FC<{
  value: string;
  onChange: (id: string) => void;
  releases: Release[];
}> = ({ value, onChange, releases }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-[250px] items-center justify-start gap-2 px-2 text-sm"
        >
          <TbSelector className="text-neutral-500" />
          <span className="overflow-hidden text-ellipsis">
            {releases.find((r) => r.id === value)?.version ?? ""}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search repo..." />
          <CommandGroup>
            <CommandList>
              {releases.map((rel) => (
                <CommandItem
                  key={rel.id}
                  value={rel.id}
                  onSelect={(v) => {
                    onChange(v);
                    setIsOpen(false);
                  }}
                >
                  {rel.version}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const DeploymentNode: React.FC<
  NodeProps<
    Deployment & { latestRelease: { id: string; version: string } | null }
  >
> = ({ data }) => {
  const { getEdges, setEdges } = useReactFlow();

  const [selectedRelease, setSelectedRelease] = useState(
    data.latestRelease?.id,
  );
  const releases = api.release.list.useQuery({ deploymentId: data.id });
  const release = releases.data?.find((r) => r.id === selectedRelease);

  const onLayout = useOnLayout();
  useEffect(() => {
    if (release == null) return;
    const deps = release.releaseDependencies.filter(isPresent);
    if (data.latestRelease == null) return;

    const edges = getEdges().filter((e) => e.source !== data.id);

    const newEdges = deps.map((d) => ({
      id: d.id,
      label: d.rule,
      target: d.deploymentId,
      source: data.id,
      animated: true,
      markerEnd: { type: MarkerType.Arrow, color: colors.neutral[500] },
      style: { stroke: colors.neutral[500] },
    }));

    setEdges([...edges, ...newEdges]);

    window.requestAnimationFrame(() => {
      sleep(200).then(onLayout);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release, onLayout]);

  return (
    <>
      <div className={cn("space-y-2 rounded-md border p-2")}>
        <div>{data.name}</div>
        <div>
          {releases.data != null && (
            <ReleaseSelector
              value={selectedRelease ?? data.latestRelease?.id ?? ""}
              onChange={setSelectedRelease}
              releases={releases.data}
            />
          )}
        </div>
      </div>
      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Right}
      />
    </>
  );
};

const nodeTypes = { deployment: DeploymentNode };
const edgeTypes = { default: DepEdge };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DependencyDiagram: React.FC<{
  deployments: Array<
    Deployment & { latestRelease: { id: string; version: string } | null }
  >;
}> = ({ deployments }) => {
  const [nodes, _, onNodesChange] = useNodesState(
    deployments.map((d) => ({
      id: d.id,
      type: "deployment",
      position: { x: 0, y: 0 },
      data: { ...d, label: d.name },
    })),
  );
  const [edges, __, onEdgesChange] = useEdgesState([]);
  const onLayout = useOnLayout();

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (reactFlowInstance != null) onLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance]);
  return (
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
    ></ReactFlow>
  );
};

export const Diagram: React.FC<{
  deployments: Array<
    Deployment & { latestRelease: { id: string; version: string } | null }
  >;
}> = ({ deployments }) => {
  return (
    <ReactFlowProvider>
      <DependencyDiagram deployments={deployments} />
    </ReactFlowProvider>
  );
};
