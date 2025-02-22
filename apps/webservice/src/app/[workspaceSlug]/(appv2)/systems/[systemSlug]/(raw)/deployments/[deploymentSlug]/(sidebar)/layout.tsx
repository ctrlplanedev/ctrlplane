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

export default async function DeploymentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => null);
  const deployment = await api.deployment.bySlug(params).catch(() => null);
  if (system == null || deployment == null) notFound();

  const url = (tab: string) =>
    `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/${tab}`;
  return (
    <SidebarProvider
      className="relative h-full"
      sidebarNames={[Sidebars.Deployment]}
    >
      <Sidebar
        className="absolute left-0 top-0 h-full"
        name={Sidebars.Deployment}
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarLink href={url("properties")}>Properties</SidebarLink>
              <SidebarLink href={url("workflow")}>Workflow</SidebarLink>
              <SidebarLink href={url("releases")}>Releases</SidebarLink>
              <SidebarLink href={url("channels")}>Channels</SidebarLink>
              <SidebarLink href={url("variables")}>Variables</SidebarLink>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="h-full w-full">{props.children}</SidebarInset>
    </SidebarProvider>
  );
}
