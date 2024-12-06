import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default function VisualizePage({
  params: { targetId },
}: {
  params: { targetId: string };
}) {
  return <ResourceVisualizationDiagramProvider resourceId={targetId} />;
}
