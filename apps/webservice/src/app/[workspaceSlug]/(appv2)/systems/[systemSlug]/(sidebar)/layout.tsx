import { notFound } from "next/navigation";
import {
  IconBook,
  IconPlant,
  IconSettings,
  IconShield,
  IconShip,
  IconVariable,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { SidebarLink } from "../../../resources/(sidebar)/SidebarLink";
import { SystemSelector } from "../../SystemSelector";

export default async function SystemsLayout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const systems = await api.system.list({ workspaceId: workspace.id });
  const selectedSystem = systems.items.find(
    (system) => system.slug === params.systemSlug,
  );

  return (
    <div className="relative rounded-tl-lg">
      <SidebarProvider>
        <Sidebar className="absolute left-0 top-0 rounded-tl-lg">
          <SidebarHeader className="rounded-tl-lg">
            <SystemSelector
              workspaceSlug={workspace.slug}
              selectedSystem={selectedSystem ?? null}
              systems={systems.items}
            />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Release Management</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconPlant />}
                  href={`/${workspace.slug}/systems/${params.systemSlug}/environments`}
                >
                  Environments
                </SidebarLink>
                <SidebarLink
                  icon={<IconShip />}
                  href={`/${workspace.slug}/systems/${params.systemSlug}/deployments`}
                >
                  Deployments
                </SidebarLink>
                <SidebarLink
                  icon={<IconVariable />}
                  href={`/${workspace.slug}/systems/${params.systemSlug}/variables`}
                >
                  Variables
                </SidebarLink>
                <SidebarLink
                  icon={<IconShield />}
                  href={`/${workspace.slug}/systems/${params.systemSlug}/policies`}
                >
                  Policies
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconBook />}
                  href={`/${workspace.slug}/systems/${params.systemSlug}/runbooks`}
                >
                  Runbooks
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>System</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconSettings />}
                  href={`/${workspace.slug}/systems/${params.systemSlug}/settings`}
                >
                  Settings
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-1px)]">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
