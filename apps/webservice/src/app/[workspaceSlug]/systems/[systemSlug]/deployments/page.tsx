import type { Metadata } from "next";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { DeploymentGettingStarted } from "./DeploymentGettingStarted";
import DeploymentTable from "./TableDeployments";

export const metadata: Metadata = { title: "Deployments - Systems" };

export default async function DeploymentsPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const system = await api.system.bySlug(params);
  const deployments = await api.deployment.bySystemId(system.id);
  const environments = await api.environment.bySystemId(system.id);

  const deploymentsWithLatestReleases = await Promise.all(
    deployments.map(async (deployment) => {
      const latestReleases =
        await api.release.getLatestByDeploymentAndEnvironments({
          deploymentId: deployment.id,
          environmentIds: environments.map((env) => env.id),
        });

      return {
        ...deployment,
        latestReleases,
      };
    }),
  );

  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>

      {deployments.length === 0 ? (
        <DeploymentGettingStarted systemId={system.id} />
      ) : (
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 container mx-auto h-[calc(100vh-40px)] overflow-auto p-8">
          <DeploymentTable
            systemSlug={params.systemSlug}
            deployments={deploymentsWithLatestReleases}
            environments={environments}
            workspaceSlug={params.workspaceSlug}
          />
        </div>
      )}
    </>
  );
}
