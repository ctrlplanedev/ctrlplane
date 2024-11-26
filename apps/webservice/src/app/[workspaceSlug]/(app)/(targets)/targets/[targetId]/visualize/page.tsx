import { api } from "~/trpc/server";
import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default async function VisualizePage({
  params: { targetId },
}: {
  params: { targetId: string };
}) {
  const relationships = await api.resource.relationships(targetId);
  return <ResourceVisualizationDiagramProvider relationships={relationships} />;
}
