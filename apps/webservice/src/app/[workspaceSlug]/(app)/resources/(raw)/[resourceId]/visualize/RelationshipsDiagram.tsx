"use client";

import type { EdgeTypes, NodeTypes } from "reactflow";
import ReactFlow, {
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import colors from "tailwindcss/colors";

import * as schema from "@ctrlplane/db/schema";
import { useSidebar } from "@ctrlplane/ui/sidebar";

import type { ResourceNodeData } from "./ResourceNode";
import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { DepEdge } from "./DepEdge";
import { ResourceNode } from "./ResourceNode";
import { useSystemSidebarContext } from "./SystemSidebarContext";

type Edge = {
  sourceId: string;
  targetId: string;
  relationshipType: schema.ResourceRelationshipRule["dependencyType"];
};

type RelationshipsDiagramProps = {
  resources: ResourceNodeData[];
  edges: Edge[];
};

const getNodes = (resources: ResourceNodeData[]) =>
  resources.map((r) => ({
    id: r.id,
    type: "resource",
    data: { data: { ...r, label: r.name }, label: r.name },
    position: { x: 0, y: 0 },
  }));

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[800],
};

/**
 * NOTE: we reverse the source and the target because for ctrlplane's logic,
 * the target of the relationship is the parent, and the source is the child
 */
const getEdges = (edges: Edge[]) =>
  edges.map((e) => ({
    id: `${e.targetId}-${e.sourceId}`,
    source: e.targetId,
    target: e.sourceId,
    style: { stroke: colors.neutral[800] },
    label: schema.ResourceDependencyTypeFlipped[e.relationshipType],
    markerEnd,
  }));

const nodeTypes: NodeTypes = { resource: ResourceNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const useCloseSidebar = () => {
  const { toggleSidebar, open } = useSidebar();
  const { setResourceAndSystem } = useSystemSidebarContext();

  return () => {
    if (open.includes("resource-visualization")) {
      toggleSidebar(["resource-visualization"]);
      setResourceAndSystem(null);
    }
  };
};

export const RelationshipsDiagram: React.FC<RelationshipsDiagramProps> = ({
  resources,
  edges,
}) => {
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>(
    getNodes(resources),
  );

  const [flowEdges, __, onEdgesChange] = useEdgesState(getEdges(edges));

  const { setReactFlowInstance } = useLayoutAndFitView(nodes, {
    direction: "LR",
    extraEdgeLength: 250,
  });

  const closeSidebar = useCloseSidebar();

  return (
    <ReactFlow
      nodes={nodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      proOptions={{ hideAttribution: true }}
      onInit={setReactFlowInstance}
      nodesDraggable
      minZoom={0.01}
      onPaneClick={closeSidebar}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
    />
  );
};

export const RelationshipsDiagramProvider: React.FC<
  RelationshipsDiagramProps
> = (props) => (
  <ReactFlowProvider>
    <RelationshipsDiagram {...props} />
  </ReactFlowProvider>
);
