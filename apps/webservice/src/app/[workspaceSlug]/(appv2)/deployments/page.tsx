import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { PageHeader } from "../_components/PageHeader";
import { DeploymentsCard } from "../systems/[systemSlug]/(sidebar)/deployments/Card";

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

  console.log(workspace);
  return (
    <div>
      <PageHeader>
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">Deployments</BreadcrumbLink>
            </BreadcrumbItem>
            {/* <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Data Fetching</BreadcrumbPage>
            </BreadcrumbItem> */}
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <DeploymentsCard workspaceId={workspace.id} />
    </div>
  );
}
