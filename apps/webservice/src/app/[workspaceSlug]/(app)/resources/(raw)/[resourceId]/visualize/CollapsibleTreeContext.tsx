"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  EdgeChange,
  Node,
  NodeChange,
  Edge as ReactFlowEdge,
  ReactFlowInstance,
} from "reactflow";
import { createContext, useContext, useState } from "react";
import { MarkerType, useEdgesState, useNodesState } from "reactflow";
import colors from "tailwindcss/colors";

import * as schema from "@ctrlplane/db/schema";

import type { Edge, ResourceNodeData } from "./types";
import {
  getLayoutedElementsDagre,
  useLayoutAndFitView,
} from "~/app/[workspaceSlug]/(app)/_components/reactflow/layout";

type CollapsibleTreeContextType = {
  allResources: ResourceNodeData[];
  allEdges: Edge[];
  expandedResources: ResourceNodeData[];
  expandedEdges: Edge[];
  addExpandedResourceIds: (resourceIds: string[]) => void;
  removeExpandedResourceIds: (resourceIds: string[]) => void;
  reactFlow: {
    nodes: Node[];
    edges: ReactFlowEdge[];
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onInit: Dispatch<SetStateAction<ReactFlowInstance | null>>;
  };
};

const CollapsibleTreeContext = createContext<CollapsibleTreeContextType | null>(
  null,
);

export const useCollapsibleTree = (): CollapsibleTreeContextType => {
  const context = useContext(CollapsibleTreeContext);
  if (!context) {
    throw new Error(
      "useCollapsibleTree must be used within a CollapsibleTreeProvider",
    );
  }
  return context;
};

const getParentResourceIds = (
  focusedResource: schema.Resource,
  resources: ResourceNodeData[],
  edges: Edge[],
  currParentResourceIds: Set<string>,
): Set<string> => {
  const parentResourceIds = edges
    .filter((edge) => edge.sourceId === focusedResource.id)
    .map((edge) => edge.targetId);

  const directParentResources = resources.filter((resource) =>
    parentResourceIds.includes(resource.id),
  );

  for (const resource of directParentResources) {
    currParentResourceIds.add(resource.id);
    getParentResourceIds(resource, resources, edges, currParentResourceIds);
  }
  return currParentResourceIds;
};

const getChildResourceIdsWithSystem = (
  focusedResource: schema.Resource,
  resources: ResourceNodeData[],
  edges: Edge[],
): Set<string> => {
  const result = new Set<string>();

  const children = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!children.has(edge.targetId)) {
      children.set(edge.targetId, []);
    }
    children.get(edge.targetId)!.push(edge.sourceId);
  });

  const hasSystems = (resourceId: string): boolean => {
    const resource = resources.find((r) => r.id === resourceId);
    return resource ? resource.systems.length > 0 : false;
  };

  const findPathsToSystems = (resourceId: string): boolean => {
    const resourceChildren = children.get(resourceId) ?? [];

    if (hasSystems(resourceId)) {
      result.add(resourceId);
      return true;
    }

    const hasValidPath = resourceChildren.some((childId) =>
      findPathsToSystems(childId),
    );

    if (hasValidPath) result.add(resourceId);
    return hasValidPath;
  };

  const directChildren = children.get(focusedResource.id) ?? [];
  directChildren.forEach((childId) => findPathsToSystems(childId));

  return result;
};

const getInitialExpandedResourceIds = (
  focusedResource: schema.Resource,
  resources: ResourceNodeData[],
  edges: Edge[],
): Set<string> => {
  const parentResourceIds = getParentResourceIds(
    focusedResource,
    resources,
    edges,
    new Set(),
  );

  const relevantChildResourceIds = getChildResourceIdsWithSystem(
    focusedResource,
    resources,
    edges,
  );

  return new Set([
    focusedResource.id,
    ...parentResourceIds,
    ...relevantChildResourceIds,
  ]);
};

const getNodes = (resources: ResourceNodeData[]) =>
  resources.map((r) => ({
    id: r.id,
    type: "resource",
    data: { data: { ...r, label: r.name }, label: r.name },
    position: { x: 0, y: 0 },
    width: 400,
    height: 68 + r.systems.length * 52,
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

type CollapsibleTreeProviderProps = {
  children: ReactNode;
  focusedResource: schema.Resource;
  resources: ResourceNodeData[];
  edges: Edge[];
};

export const CollapsibleTreeProvider: React.FC<
  CollapsibleTreeProviderProps
> = ({ children, focusedResource, resources, edges }) => {
  const initialExpandedResourceIds = getInitialExpandedResourceIds(
    focusedResource,
    resources,
    edges,
  );

  const [expandedResourceIds, setExpandedResourceIds] = useState<Set<string>>(
    initialExpandedResourceIds,
  );

  const expandedResources = resources.filter((resource) =>
    expandedResourceIds.has(resource.id),
  );

  const expandedEdges = edges.filter(
    (edge) =>
      expandedResourceIds.has(edge.sourceId) &&
      expandedResourceIds.has(edge.targetId),
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<{ label: string }>(
    getNodes(expandedResources),
  );

  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(
    getEdges(expandedEdges),
  );

  const { setReactFlowInstance: onInit, fitView } = useLayoutAndFitView(nodes, {
    direction: "LR",
    extraEdgeLength: 250,
  });

  const addExpandedResourceIds = (resourceIds: string[]) => {
    setExpandedResourceIds((prev) => {
      const newSet = new Set(prev);
      resourceIds.forEach((id) => newSet.add(id));

      const newExpandedResources = resources.filter((resource) =>
        newSet.has(resource.id),
      );
      const newExpandedEdges = edges.filter(
        (edge) => newSet.has(edge.sourceId) && newSet.has(edge.targetId),
      );

      const newNodes = getNodes(newExpandedResources);
      const newEdges = getEdges(newExpandedEdges);

      const layouted = getLayoutedElementsDagre(newNodes, newEdges, "LR", 250);

      setNodes(layouted.nodes);
      setEdges(layouted.edges);

      return newSet;
    });

    setTimeout(fitView, 50);
  };

  const removeExpandedResourceIds = (resourceIds: string[]) => {
    setExpandedResourceIds((prev) => {
      const newSet = new Set(prev);
      resourceIds.forEach((id) => newSet.delete(id));

      const newNodes = nodes.filter((node) => newSet.has(node.id));
      const newEdges = flowEdges.filter(
        (edge) => newSet.has(edge.source) && newSet.has(edge.target),
      );

      const layouted = getLayoutedElementsDagre(newNodes, newEdges, "LR", 250);

      setNodes(layouted.nodes);
      setEdges(layouted.edges);

      return newSet;
    });

    setTimeout(fitView, 50);
  };

  const value: CollapsibleTreeContextType = {
    expandedResources,
    expandedEdges,
    allResources: resources,
    allEdges: edges,
    addExpandedResourceIds,
    removeExpandedResourceIds,
    reactFlow: {
      nodes,
      edges: flowEdges,
      onNodesChange,
      onEdgesChange,
      onInit,
    },
  };

  return (
    <CollapsibleTreeContext.Provider value={value}>
      {children}
    </CollapsibleTreeContext.Provider>
  );
};
