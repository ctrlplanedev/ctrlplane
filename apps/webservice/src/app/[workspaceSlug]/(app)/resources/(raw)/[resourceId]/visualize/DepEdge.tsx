import type { EdgeProps } from "reactflow";
import { capitalCase } from "change-case";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "reactflow";

export const DepEdge: React.FC<EdgeProps> = ({
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

  const edgeLabel = capitalCase(String(label).replace(/_/g, " "));

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
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
          }}
          className="nodrag nopan absolute z-10 text-sm"
        >
          {edgeLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
