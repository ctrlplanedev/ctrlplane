import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
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
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.System}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Deployments</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

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
      />
    </div>
  );
}
