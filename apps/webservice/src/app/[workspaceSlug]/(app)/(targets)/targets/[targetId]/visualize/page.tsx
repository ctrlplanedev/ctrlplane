import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default async function VisualizePage({
  params: { targetId },
}: {
  params: { targetId: string };
}) {
  const relationships = await api.resource.relationships(targetId);
  if (relationships == null) return notFound();
  return <ResourceVisualizationDiagramProvider relationships={relationships} />;
}
