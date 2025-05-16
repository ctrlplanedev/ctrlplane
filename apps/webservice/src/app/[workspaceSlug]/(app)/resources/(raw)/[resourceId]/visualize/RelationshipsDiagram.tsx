"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { EdgeTypes, NodeTypes } from "reactflow";
import ReactFlow, {
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import colors from "tailwindcss/colors";

import { useLayoutAndFitView } from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";
import { DepEdge } from "./DepEdge";
import { ResourceNode } from "./ResourceNode";

type ParentRelationship = {
  ruleId: string;
  type: schema.ResourceDependencyType;
  target: schema.Resource;
  reference: string;
};

type ChildRelationship = {
  ruleId: string;
  type: schema.ResourceDependencyType;
  source: schema.Resource;
  reference: string;
};

type RelationshipsDiagramProps = {
  resource: schema.Resource;
  parents: ParentRelationship[];
  children: ChildRelationship[];
};

const getNodes = (resources: schema.Resource[]) =>
  resources.map((r) => ({
    id: r.id,
    type: "resource",
    data: { ...r, label: r.identifier },
    position: { x: 0, y: 0 },
  }));

const markerEnd = {
  type: MarkerType.Arrow,
  color: colors.neutral[800],
};

const nodeTypes: NodeTypes = { resource: ResourceNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const getParentEdges = (
  parents: ParentRelationship[],
  resource: schema.Resource,
) =>
  parents.map((p) => ({
    id: `${p.ruleId}-${p.target.id}`,
    source: p.target.id,
    target: resource.id,
    style: { stroke: colors.neutral[800] },
    markerEnd,
    label: p.type,
  }));

const getChildEdges = (
  children: ChildRelationship[],
  resource: schema.Resource,
) =>
  children.map((c) => ({
    id: `${c.ruleId}-${c.source.id}`,
    source: resource.id,
    target: c.source.id,
    style: { stroke: colors.neutral[800] },
    markerEnd,
    label: c.type,
  }));

export const RelationshipsDiagram: React.FC<RelationshipsDiagramProps> = ({
  resource,
  parents,
  children,
}) => {
  const [nodes, _, onNodesChange] = useNodesState<{ label: string }>(
    getNodes([
      resource,
      ...parents.map((p) => p.target),
      ...children.map((c) => c.source),
    ]),
  );

  const [edges, __, onEdgesChange] = useEdgesState([
    ...getParentEdges(parents, resource),
    ...getChildEdges(children, resource),
  ]);

  const { setReactFlowInstance } = useLayoutAndFitView(nodes, {
    direction: "LR",
    extraEdgeLength: 50,
    focusedNodeId: resource.id,
  });

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      proOptions={{ hideAttribution: true }}
      onInit={setReactFlowInstance}
      nodesDraggable
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
    />
  );
};

export const RelationshipsDiagramProvider: React.FC<
  RelationshipsDiagramProps
> = ({ resource, parents, children }) => {
  return (
    <ReactFlowProvider>
      <RelationshipsDiagram
        resource={resource}
        parents={parents}
        children={children}
      />
    </ReactFlowProvider>
  );
};
