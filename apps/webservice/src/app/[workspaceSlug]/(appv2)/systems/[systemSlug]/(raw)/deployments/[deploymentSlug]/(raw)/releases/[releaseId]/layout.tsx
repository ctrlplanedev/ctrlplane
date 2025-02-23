import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { SidebarLink } from "~/app/[workspaceSlug]/(appv2)/resources/(sidebar)/SidebarLink";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";

export default async function ReleaseLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
  }>;
}) {
  const params = await props.params;
  const release = await api.release.byId(params.releaseId);
  if (release == null) notFound();

  const deployment = await api.deployment.byId(release.deploymentId);

  const url = (tab: string) =>
    `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/releases/${params.releaseId}/${tab}`;

  return (
    <div className="h-full w-full">
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`}
          >
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Deployments</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/releases`}
                >
                  {deployment.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{release.version}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>

      <SidebarProvider
        sidebarNames={[Sidebars.Release]}
        className="relative h-full"
      >
        <Sidebar
          name={Sidebars.Release}
          className="absolute left-0 top-0 h-full"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink href={url("jobs")}>Jobs</SidebarLink>
                <SidebarLink href={url("checks")}>Checks</SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-full w-full">{props.children}</SidebarInset>
      </SidebarProvider>
    </div>
  );
}
