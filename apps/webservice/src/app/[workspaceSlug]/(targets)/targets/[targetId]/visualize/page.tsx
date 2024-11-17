import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default async function VisualizePage({
  params: { targetId },
}: {
  params: { targetId: string };
}) {
  const resource = await api.resource.byId(targetId);
  if (resource == null) return notFound();
  const relationships = await api.resource.relationships(resource.id);
  if (relationships == null) return notFound();

  return (
    <ResourceVisualizationDiagramProvider
      resource={resource}
      relationships={relationships}
    />
  );
}
