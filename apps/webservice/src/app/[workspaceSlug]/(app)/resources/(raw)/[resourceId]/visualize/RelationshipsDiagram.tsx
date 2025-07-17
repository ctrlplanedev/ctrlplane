"use client";

import type { EdgeTypes, NodeTypes } from "reactflow";
import ReactFlow from "reactflow";

import { useCollapsibleTree } from "./CollapsibleTreeContext";
import { DepEdge } from "./DepEdge";
import { ResourceDrawer } from "./resource-drawer/ResourceDrawer";
import { useResourceDrawer } from "./resource-drawer/useResourceDrawer";
import { ResourceNode } from "./resource-node/ResourceNode";

const nodeTypes: NodeTypes = { resource: ResourceNode };
const edgeTypes: EdgeTypes = { default: DepEdge };

export const RelationshipsDiagram: React.FC = () => {
  const { reactFlow } = useCollapsibleTree();
  const { resourceId, setResourceId, removeResourceId } = useResourceDrawer();

  return (
    <>
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
    </>
  );
};
