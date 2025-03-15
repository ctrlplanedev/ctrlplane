import type { EdgeProps } from "reactflow";
import { BaseEdge, getSmoothStepPath, MarkerType } from "reactflow";
import colors from "tailwindcss/colors";

export const ArrowEdge: React.FC<EdgeProps> = (edge) => {
  const { markerEnd, style } = edge;
  const [edgePath] = getSmoothStepPath(edge);

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd ?? MarkerType.ArrowClosed}
      style={{
        strokeWidth: 2,
        stroke: colors.neutral[700],
        ...style,
      }}
    />
  );
};
