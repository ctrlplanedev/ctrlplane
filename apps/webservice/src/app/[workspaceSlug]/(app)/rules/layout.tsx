import { notFound } from "next/navigation";
import {
  IconActivity,
  IconArrowDown,
  IconBarrierBlock,
  IconCalendarTime,
  IconChartBar,
  IconClock,
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
import { api } from "~/trpc/server";
import { SidebarLink } from "./SidebarLink";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="relative">
      <SidebarProvider sidebarNames={[Sidebars.Rules]}>
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Rules}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Overview</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconList />}
                  href={`/${workspace.slug}/rules`}
                  exact
                >
                  Rules Dashboard
                </SidebarLink>
                <SidebarLink
                  icon={<IconChartBar />}
                  href={`/${workspace.slug}/rules/analytics`}
                >
                  Analytics
                </SidebarLink>
                <SidebarLink
                  icon={<IconSettings />}
                  href={`/${workspace.slug}/rules/settings`}
                >
                  Settings
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Time-Based Rules</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconClock />}
                  href={`/${workspace.slug}/rules/time-windows`}
                >
                  Time Windows
                </SidebarLink>
                <SidebarLink
                  icon={<IconCalendarTime />}
                  href={`/${workspace.slug}/rules/maintenance`}
                >
                  Maintenance Windows
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Rollout Control</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarLink
                  icon={<IconArrowDown />}
                  href={`/${workspace.slug}/rules/rollout`}
                >
                  Gradual Rollouts
                </SidebarLink>
                <SidebarLink
                  icon={<IconActivity />}
                  href={`/${workspace.slug}/rules/success-rate`}
                >
                  Success Criteria
                </SidebarLink>
                <SidebarLink
                  icon={<IconSitemap />}
                  href={`/${workspace.slug}/rules/dependencies`}
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
                  href={`/${workspace.slug}/rules/approval`}
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
