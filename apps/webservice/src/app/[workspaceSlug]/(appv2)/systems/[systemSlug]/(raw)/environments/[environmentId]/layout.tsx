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
import { AnalyticsSidebarProvider } from "./AnalyticsSidebarContext";
import { EnvironmentHeader } from "./EnvironmentHeader";
import { EnvironmentSidebar } from "./EnvironmentSidebar";

export default async function EnvironmentLayout(props: {
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
    `/${params.workspaceSlug}/systems/${params.systemSlug}/environments/${params.environmentId}/${tab}`;
  return (
    <AnalyticsSidebarProvider>
      <div className="h-full">
        <EnvironmentHeader
          workspaceSlug={params.workspaceSlug}
          systemSlug={params.systemSlug}
          environmentName={environment.name}
        />

        <SidebarProvider className="relative">
          <Sidebar className="absolute bottom-0 left-0">
            <SidebarContent>
              <SidebarGroup>
                <SidebarMenu>
                  <SidebarLink href={url("deployments")}>
                    Deployments
                  </SidebarLink>
                  <SidebarLink href={url("policies")}>Policies</SidebarLink>
                  <SidebarLink href={url("workflow")}>Workflow</SidebarLink>
                  <SidebarLink href={url("resources")}>Resources</SidebarLink>
                  <SidebarLink href={url("variables")}>Variables</SidebarLink>
                  <SidebarLink href={url("settings")}>Settings</SidebarLink>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="flex h-[calc(100vh-56px-64px-2px)] flex-row">
            {props.children}
            <EnvironmentSidebar environmentId={environment.id} />
          </SidebarInset>
        </SidebarProvider>
      </div>
    </AnalyticsSidebarProvider>
  );
}
