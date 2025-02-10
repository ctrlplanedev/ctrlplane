import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default async function VisualizePage(props: {
  params: Promise<{ resourceId: string }>;
}) {
  const params = await props.params;
  const { resourceId } = params;

  return <ResourceVisualizationDiagramProvider resourceId={resourceId} />;
}
