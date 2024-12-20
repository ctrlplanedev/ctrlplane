import { DependenciesGettingStarted } from "./DependenciesGettingStarted";

export default function Dependencies() {
  return <DependenciesGettingStarted />;

  // const workspace = await api.workspace.bySlug(params.workspaceSlug);
  // if (workspace == null) notFound();
  // const deployments = await api.deployment.byWorkspaceId(workspace.id);

  // if (
  //   deployments.length === 0 ||
  //   deployments.some((d) => d.latestActiveReleases != null)
  // )
  //   return <DependenciesGettingStarted />;

  // const transformedDeployments = deployments.map((deployment) => ({
  //   ...deployment,
  //   latestActiveRelease: deployment.latestActiveReleases && {
  //     id: deployment.latestActiveReleases.id,
  //     version: deployment.latestActiveReleases.version,
  //   },
  // }));

  // return (
  //   <div className="h-full">
  //     <Diagram deployments={transformedDeployments} />
  //   </div>
  // );
}
