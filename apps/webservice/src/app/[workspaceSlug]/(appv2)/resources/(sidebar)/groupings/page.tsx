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

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { CreateMetadataGroupDialog } from "./CreateMetadataGroupDialog";
import { ResourceGroupsTable } from "./ResourceGroupTable";
import { ResourceMetadataGroupsGettingStarted } from "./ResourceMetadataGroupsGettingStarted";

export const metadata = {
  title: "Resource Groupings - Ctrlplane",
};

export default async function GroupingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const metadataGroups = await api.resource.metadataGroup.groups(workspace.id);
  if (metadataGroups.length === 0)
    return <ResourceMetadataGroupsGettingStarted workspace={workspace} />;
  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Resources}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Groupings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateMetadataGroupDialog workspaceId={workspace.id}>
          <Button variant="outline" size="sm">
            Create Metadata Group
          </Button>
        </CreateMetadataGroupDialog>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto">
        <ResourceGroupsTable
          workspace={workspace}
          metadataGroups={metadataGroups}
        />
      </div>
    </div>
  );
}
