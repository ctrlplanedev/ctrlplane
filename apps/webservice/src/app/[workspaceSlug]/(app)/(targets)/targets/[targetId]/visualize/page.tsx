import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default async function VisualizePage({
  params: { targetId },
}: {
  params: { targetId: string };
}) {
  const [resource, relationships] = await Promise.all([
    api.resource.byId(targetId),
    api.resource.relationships(targetId),
  ]);
  if (resource == null || relationships == null) return notFound();

  return (
    <ResourceVisualizationDiagramProvider
      resource={resource}
      relationships={relationships}
    />
  );
}
