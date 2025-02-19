import type { Metadata } from "next";
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

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { WorkspaceDeleteSection } from "./WorkspaceDeleteSection";
import { WorkspaceUpdateSection } from "./WorkspaceUpdateSection";

export const metadata: Metadata = { title: "General - Workspace Settings" };

export default async function WorkspaceGeneralSettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div>
      <PageHeader>
        <SidebarTrigger name={Sidebars.Workspace}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>General</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto pt-8">
        <div className="container mx-auto max-w-2xl space-y-8">
          <WorkspaceUpdateSection workspace={workspace} />

          <div className="border-b" />

          <WorkspaceDeleteSection />
        </div>
      </div>
    </div>
  );
}
