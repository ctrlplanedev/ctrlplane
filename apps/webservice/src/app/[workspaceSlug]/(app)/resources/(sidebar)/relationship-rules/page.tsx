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

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { PageHeader } from "../../../_components/PageHeader";
import { RelationshipRulesTable } from "./components/RelationshipRulesTable";

interface PageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return {};

  return {
    title: `Relationship Rules - ${workspace.name}`,
    description: `Manage relationship rules for resources in ${workspace.name}`,
  };
}

export default async function RelationshipRulesPage({ params }: PageProps) {
  const { workspaceSlug } = await params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <SidebarTrigger name={Sidebars.Resources}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Relationship Rules</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-8">
        <RelationshipRulesTable workspaceId={workspace.id} />
      </div>
    </div>
  );
}
