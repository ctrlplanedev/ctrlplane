import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import DeploymentTable from "./TableDeployments";

export default async function EnvironmentsPage(props: {
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

      <DeploymentTable
        workspace={workspace}
        systemSlug={params.systemSlug}
        environments={environments}
        deployments={deployments}
        className="border-b"
      />
    </div>
  );
}
