import { notFound } from "next/navigation";
import {
  IconApi,
  IconInfoCircle,
  IconPlug,
  IconSettings,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { Sidebars } from "../../sidebars";
import { SidebarLink } from "../resources/(sidebar)/SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="relative">
      <SidebarProvider sidebarNames={[Sidebars.Workspace]}>
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Workspace}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconInfoCircle />}
                  href={`/${workspace.slug}/settings/workspace/overview`}
                >
                  Overview
                </SidebarLink>
                <SidebarLink
                  icon={<IconSettings />}
                  href={`/${workspace.slug}/settings/workspace/general`}
                >
                  General
                </SidebarLink>
                <SidebarLink
                  icon={<IconUsers />}
                  href={`/${workspace.slug}/settings/workspace/members`}
                >
                  Members
                </SidebarLink>
                <SidebarLink
                  icon={<IconPlug />}
                  href={`/${workspace.slug}/settings/workspace/integrations`}
                >
                  Integrations
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconUser />}
                  href={`/${workspace.slug}/settings/account/profile`}
                >
                  Profile
                </SidebarLink>
                <SidebarLink
                  icon={<IconApi />}
                  href={`/${workspace.slug}/settings/account/api`}
                >
                  API
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
