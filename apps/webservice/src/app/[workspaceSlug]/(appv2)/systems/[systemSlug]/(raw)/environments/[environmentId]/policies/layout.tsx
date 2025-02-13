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
import { api } from "~/trpc/server";

export default async function PoliciesLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const params = await props.params;
  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  const url = (tab: string) =>
    `/${params.workspaceSlug}/systems/${params.systemSlug}/environments/${params.environmentId}/policies/${tab}`;

  return (
    <SidebarProvider className="relative">
      <Sidebar className="absolute bottom-0 left-0">
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarLink href={url("approval")}>
                Approval & Governance
              </SidebarLink>
              <SidebarLink href={url("control")}>
                Deployment Control
              </SidebarLink>
              <SidebarLink href={url("management")}>
                Release Management
              </SidebarLink>
              <SidebarLink href={url("channels")}>Release Channels</SidebarLink>
              <SidebarLink href={url("rollout")}>Rollout & Timing</SidebarLink>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="container h-[calc(100vh-56px-64px-2px)] pt-8">
        {props.children}
      </SidebarInset>
    </SidebarProvider>
  );
}
