import type { Metadata } from "next";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { DeploymentGettingStarted } from "./DeploymentGettingStarted";
import DeploymentTable from "./TableDeployments";

export const metadata: Metadata = { title: "Deployments - Systems" };

export default async function SystemDeploymentsPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const system = await api.system.bySlug(params);
  const deployments = await api.deployment.bySystemId(system.id);
  const environments = await api.environment.bySystemId(system.id);
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>

      {deployments.length === 0 ? (
        <DeploymentGettingStarted systemId={system.id} />
      ) : (
        <div className="container mx-auto p-8">
          <DeploymentTable
            deployments={deployments}
            environments={environments}
            systemSlug={params.systemSlug}
          />
        </div>
      )}
    </>
  );
}
