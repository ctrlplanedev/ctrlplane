import type { Edge, Node, ReactFlowInstance } from "reactflow";
import { useEffect, useRef } from "react";
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
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // const onLayout = useCallback(() => {
  //   const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodes(
  //     nodes,
  //     edges,
  //   );

  //   setNodes(layoutedNodes as Node[]);
  //   setEdges(layoutedEdges);
  // }, [nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    if (computedNodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodes(
        computedNodes,
        computedEdges,
      );
      setNodes(layoutedNodes as Node[]);
      setEdges(layoutedEdges);

      // Fit view after layout is applied
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ duration: 200 });
      }, 0);
    }
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      onInit={(instance) => {
        reactFlowInstance.current = instance;
        setTimeout(() => {
          instance.fitView({ duration: 200 });
        }, 50);
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
