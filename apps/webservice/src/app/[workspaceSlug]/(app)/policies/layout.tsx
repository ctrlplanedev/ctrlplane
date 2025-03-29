import { notFound } from "next/navigation";
import {
  IconActivity,
  IconArrowDown,
  IconBarrierBlock,
  IconCalendarTime,
  IconChartBar,
  IconList,
  IconSettings,
  IconSitemap,
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

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { SidebarLink } from "./_components/SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="relative">
      <SidebarProvider sidebarNames={[Sidebars.Policies]}>
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Policies}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Overview</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconList />}
                  href={urls.workspace(workspace.slug).policies().baseUrl()}
                  exact
                >
                  Dashboard
                </SidebarLink>
                <SidebarLink
                  icon={<IconChartBar />}
                  href={urls.workspace(workspace.slug).policies().analytics()}
                >
                  Analytics
                </SidebarLink>
                <SidebarLink
                  icon={<IconSettings />}
                  href={urls.workspace(workspace.slug).policies().settings()}
                >
                  Settings
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Time-Based Rules</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconCalendarTime />}
                  href={urls.workspace(workspace.slug).policies().denyWindows()}
                >
                  Deny Windows
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Rollout Control</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconArrowDown />}
                  href={urls
                    .workspace(workspace.slug)
                    .policies()
                    .gradualRollouts()}
                >
                  Gradual Rollouts
                </SidebarLink>
                <SidebarLink
                  icon={<IconActivity />}
                  href={urls
                    .workspace(workspace.slug)
                    .policies()
                    .successCriteria()}
                >
                  Success Criteria
                </SidebarLink>
                <SidebarLink
                  icon={<IconSitemap />}
                  href={urls
                    .workspace(workspace.slug)
                    .policies()
                    .dependencies()}
                >
                  Dependencies
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Advanced Rules</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconBarrierBlock />}
                  href={urls
                    .workspace(workspace.slug)
                    .policies()
                    .approvalGates()}
                >
                  Approval Gates
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-[calc(100vh-56px-2px)]">
          {props.children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
