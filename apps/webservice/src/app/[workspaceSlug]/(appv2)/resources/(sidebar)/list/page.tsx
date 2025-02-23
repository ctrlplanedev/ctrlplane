import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { PageHeader } from "../../../_components/PageHeader";
import { ResourcePageContent } from "./ResourcePageContent";

export default async function ResourcesPage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const view =
    searchParams.view != null
      ? await api.resource.view.byId(searchParams.view)
      : null;

  return (
    <div>
      <PageHeader>
        <SidebarTrigger name={Sidebars.Resources}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>Resources</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>
      <ResourcePageContent workspace={workspace} view={view} />
    </div>
  );
}
