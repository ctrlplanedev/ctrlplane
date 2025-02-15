import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { DeploymentGettingStarted } from "./DeploymentGettingStarted";
import DeploymentTable from "./TableDeployments";

export const metadata: Metadata = { title: "Deployments - Systems" };

export default async function SystemDeploymentsPage(
  props: {
    params: Promise<{ workspaceSlug: string; systemSlug: string }>;
  }
) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
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
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 container mx-auto overflow-auto p-8">
          <DeploymentTable
            deployments={deployments}
            environments={environments}
            systemSlug={params.systemSlug}
            workspace={workspace}
          />
        </div>
      )}
    </>
  );
}
