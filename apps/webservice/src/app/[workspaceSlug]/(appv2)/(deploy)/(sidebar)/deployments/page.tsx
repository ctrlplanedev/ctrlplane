import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { DeploymentsCard } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/Card";
import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Deployments | Ctrlplane",
};

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function DeploymentsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="flex flex-col">
      <PageHeader className="z-10 flex items-center justify-between">
        <SidebarTrigger name={Sidebars.Deployments}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <CreateDeploymentDialog>
          <Button variant="outline" size="sm">
            Create Deployment
          </Button>
        </CreateDeploymentDialog>
      </PageHeader>

      <DeploymentsCard workspaceId={workspace.id} />
    </div>
  );
}
