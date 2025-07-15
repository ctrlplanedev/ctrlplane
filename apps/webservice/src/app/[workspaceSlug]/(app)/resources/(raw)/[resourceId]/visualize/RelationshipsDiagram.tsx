"use client";

import type { EdgeTypes, NodeTypes } from "reactflow";
import ReactFlow from "reactflow";

import { useSidebar } from "@ctrlplane/ui/sidebar";

import { useCollapsibleTree } from "./CollapsibleTreeContext";
import { DepEdge } from "./DepEdge";
import { ResourceNode } from "./resource-node/ResourceNode";
import { useSystemSidebarContext } from "./SystemSidebarContext";

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

export const RelationshipsDiagram: React.FC = () => {
  const { reactFlow } = useCollapsibleTree();
  const closeSidebar = useCloseSidebar();

  return (
    <ReactFlow
      {...reactFlow}
      fitView
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      minZoom={0.01}
      onPaneClick={closeSidebar}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
    />
  );
};
