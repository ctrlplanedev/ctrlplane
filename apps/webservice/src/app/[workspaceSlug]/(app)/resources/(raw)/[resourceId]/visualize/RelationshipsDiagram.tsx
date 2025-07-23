"use client";

import type { EdgeTypes, NodeTypes } from "reactflow";
import { IconChevronRight } from "@tabler/icons-react";
import ReactFlow from "reactflow";

import { cn } from "@ctrlplane/ui";
import { SidebarTrigger, useSidebar } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { useCollapsibleTree } from "./CollapsibleTreeContext";
import { DepEdge } from "./DepEdge";
import { FlowToolbar } from "./FlowToolbar";
import { ResourceDrawer } from "./resource-drawer/ResourceDrawer";
import { useResourceDrawer } from "./resource-drawer/useResourceDrawer";
import { ResourceNode } from "./resource-node/ResourceNode";

const nodeTypes: NodeTypes = { resource: ResourceNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

const ResourceSidebarTrigger: React.FC = () => {
  const { open: openSidebars } = useSidebar();
  const isOpen = openSidebars.includes(Sidebars.Resource);

  return (
    <div className="absolute left-0 top-0 z-10 p-2">
      <SidebarTrigger name={Sidebars.Resource}>
        <IconChevronRight
          className={cn(
            "size-4 transition-transform duration-200",
            isOpen ? "rotate-180" : "rotate-0",
          )}
        />
      </SidebarTrigger>
    </div>
  );
};

export const RelationshipsDiagram: React.FC = () => {
  const { reactFlow } = useCollapsibleTree();
  const { resourceId, setResourceId, removeResourceId } = useResourceDrawer();

  return (
    <div className="relative h-full w-full">
      <ResourceSidebarTrigger />
      <ResourceDrawer />
      <ReactFlow
        {...reactFlow}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        minZoom={0.01}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => {
          const nodeResourceId = node.id;
          if (nodeResourceId === resourceId) {
            removeResourceId();
            return;
          }
          setResourceId(nodeResourceId);
        }}
      />
      <FlowToolbar />
    </div>
  );
};
