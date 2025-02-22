import React from "react";
import { notFound } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

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

  const url = (tab: string) =>
    `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/releases/${params.releaseId}/${tab}`;

  return (
    <SidebarProvider
      sidebarNames={[Sidebars.Release]}
      className="relative h-full"
    >
      <Sidebar name={Sidebars.Release} className="absolute left-0 top-0 h-full">
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
  );
}
