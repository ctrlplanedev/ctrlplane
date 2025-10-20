import type { Edge, Node } from "reactflow";
import { useCallback } from "react";
import { useMount } from "react-use";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useEdgesState,
  useNodesState,
} from "reactflow";

import "reactflow/dist/style.css";

import { edgeTypes, nodeTypes } from "./flow";
import { layoutNodes } from "./flow/layout";

type DeploymentFlowProps = {
  computedNodes: Node[];
  computedEdges: Edge[];
};

export const DeploymentFlow: React.FC<DeploymentFlowProps> = ({
  computedNodes,
  computedEdges,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodes(
      nodes,
      edges,
    );

    setNodes(layoutedNodes as Node[]);
    setEdges(layoutedEdges);
  }, [nodes, edges, setNodes, setEdges]);

  useMount(() => onLayout());

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      onInit={(reactFlowInstance) => {
        reactFlowInstance.fitView({ duration: 200 });
      }}
      minZoom={0.5}
      maxZoom={1.5}
      defaultEdgeOptions={{
        type: "smoothstep",
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      <Controls />
    </ReactFlow>
  );
};
