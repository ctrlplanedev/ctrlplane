import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default function VisualizePage({
  params: { resourceId },
}: {
  params: { resourceId: string };
}) {
  return <ResourceVisualizationDiagramProvider resourceId={resourceId} />;
}
