import { notFound } from "next/navigation";
import {
  IconBook,
  IconPlant,
  IconShip,
  IconVariable,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { SidebarLink } from "../../resources/SidebarLink";
import { SystemSelector } from "../SystemSelector";

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
    <div className="relative">
      <SidebarProvider>
        <Sidebar className="absolute left-0 top-0 -z-10">
          <SidebarHeader>
            <SystemSelector
              workspaceSlug={workspace.slug}
              selectedSystem={selectedSystem ?? null}
              systems={systems.items}
            />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconPlant />}
                  href={`/${workspace.slug}/systems/list`}
                >
                  Environments
                </SidebarLink>
                <SidebarLink
                  icon={<IconShip />}
                  href={`/${workspace.slug}/resources/providers`}
                >
                  Deployments
                </SidebarLink>
                <SidebarLink
                  icon={<IconBook />}
                  href={`/${workspace.slug}/resources/groupings`}
                >
                  Runbooks
                </SidebarLink>
                <SidebarLink
                  icon={<IconVariable />}
                  href={`/${workspace.slug}/resources/views`}
                >
                  Variables Sets
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
