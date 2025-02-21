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

import { DeploymentsCard } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/Card";
import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";

export default async function EnvironmentsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => null);
  if (system == null) notFound();

  return (
    <div>
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

      <div className="container m-8 mx-auto">
        <DeploymentsCard
          workspaceId={system.workspaceId}
          systemId={system.id}
        />
      </div>
    </div>
  );
}
