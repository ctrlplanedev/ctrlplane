import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ResourceVisualizationDiagramProvider } from "./ResourceVisualizationDiagram";

export default async function VisualizePage({
  params: { targetId },
}: {
  params: { targetId: string };
}) {
  const resourceId = targetId;
  const resourcePromise = api.resource.byId(resourceId);
  const relationshipsPromise = api.resource.relationships(resourceId);
  const [resource, relationships] = await Promise.all([
    resourcePromise,
    relationshipsPromise,
  ]);
  if (resource == null || relationships == null) return notFound();

  return (
    <ResourceVisualizationDiagramProvider
      resource={resource}
      relationships={relationships}
    />
  );
}
