import { api } from "~/trpc/server";

export default async function DeploymentTargetsPage({
  params,
}: {
  params: {
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    targetId: string;
  };
}) {
  const target = await api.resource.byId(params.targetId);
  return (
    <div className="container mx-auto">
      <h1>{target?.name}</h1>
    </div>
  );
}
