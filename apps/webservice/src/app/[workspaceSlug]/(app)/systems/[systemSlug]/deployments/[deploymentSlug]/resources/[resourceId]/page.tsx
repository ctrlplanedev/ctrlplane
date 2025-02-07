import { api } from "~/trpc/server";

export default async function DeploymentResourcesPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    resourceId: string;
  }>;
}) {
  const params = await props.params;
  const resource = await api.resource.byId(params.resourceId);
  return (
    <div className="container mx-auto">
      <h1>{resource?.name}</h1>
    </div>
  );
}
