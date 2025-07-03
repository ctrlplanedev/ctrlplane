import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { DeploymentGettingStarted } from "./DeploymentGettingStarted";
import DeploymentTable from "./TableDeployments";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string; systemSlug: string };
}): Promise<Metadata> => {
  try {
    const system = await api.system.bySlug(props.params);
    return {
      title: `Deployments | ${system.name} | Ctrlplane`,
      description: `Manage deployments for the ${system.name} system in Ctrlplane.`,
    };
  } catch {
    return {
      title: "Deployments | Ctrlplane",
      description: "Manage system deployments in Ctrlplane.",
    };
  }
};

export default async function DeploymentsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;

  const [workspace, system] = await Promise.all([
    api.workspace.bySlug(params.workspaceSlug),
    api.system.bySlug(params),
  ]);
  if (workspace == null) notFound();

  const [environments, deployments] = await Promise.all([
    api.environment.bySystemId(system.id),
    api.deployment.bySystemId(system.id),
  ]);

  const hasDeployments = deployments.length > 0;

  return (
    <div className="flex min-w-0 flex-col overflow-x-auto">
      <PageHeader className="flex items-center justify-between">
        <SystemBreadcrumb system={system} page="Deployments" />

        <CreateDeploymentDialog systemId={system.id}>
          <Button
            className="flex items-center gap-2"
            variant="outline"
            size="sm"
          >
            Create Deployment
          </Button>
        </CreateDeploymentDialog>
      </PageHeader>

      {hasDeployments ? (
        <DeploymentTable
          workspace={workspace}
          systemSlug={params.systemSlug}
          environments={environments}
          deployments={deployments}
          className="border-b"
        />
      ) : (
        <DeploymentGettingStarted systemId={system.id} />
      )}
    </div>
  );
}
