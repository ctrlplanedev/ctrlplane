import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DependenciesGettingStarted } from "./DependenciesGettingStarted";
import { Diagram } from "./DependencyDiagram";

export default async function Dependencies({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  const deployments = await api.deployment.byWorkspaceId(workspace.id);

  if (
    deployments.length === 0 ||
    deployments.some((d) => d.latestRelease != null)
  )
    return <DependenciesGettingStarted />;

  return (
    <div className="h-full">
      <Diagram deployments={deployments} />
    </div>
  );
}
