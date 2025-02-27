import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";
import LZString from "lz-string";

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
import { CreateResourceViewDialog } from "~/app/[workspaceSlug]/(appv2)/_components/resources/condition/ResourceConditionDialog";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { ResourceViewsTable } from "./ResourceViewsTable";

export const metadata = {
  title: "Saved Views - Ctrlplane",
};

export default async function ViewsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;

  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (!workspace) return notFound();

  const views = await api.resource.view.list(workspace.id);
  const viewsWithHash = views.map((view) => ({
    ...view,
    hash: LZString.compressToEncodedURIComponent(JSON.stringify(view.filter)),
  }));
  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Resources}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Views</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateResourceViewDialog workspaceId={workspace.id} filter={null}>
          <Button variant="outline" size="sm">
            Add View
          </Button>
        </CreateResourceViewDialog>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto">
        <ResourceViewsTable workspace={workspace} views={viewsWithHash} />
      </div>
    </div>
  );
}
