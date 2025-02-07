import { notFound } from "next/navigation";

import { DeploymentsView } from "~/app/[workspaceSlug]/(appv2)/_components/deployment-view/DeploymentView";
import { api } from "~/trpc/server";
import { ResourceVisualizationDiagramProvider } from "./visualize/ResourceVisualizationDiagram";

type Params = Promise<{ resourceId: string }>;
type SearchParams = Promise<{ tab?: string }>;

export default async function ResourcePage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const params = await props.params;
  const { resourceId } = params;
  const { tab } = await props.searchParams;

  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  if (tab === "visualize")
    return <ResourceVisualizationDiagramProvider resourceId={resourceId} />;

  return (
    <DeploymentsView
      workspaceId={resource.workspaceId}
      resourceId={resourceId}
    />
  );
}
