import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconChevronLeft } from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenuButton,
} from "@ctrlplane/ui/sidebar";

import { SidebarNavMain } from "../SidebarNavMain";

export const SettingsSidebar: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenuButton asChild tooltip="Settings">
          <Link
            href={`/${workspace.slug}`}
            className="flex w-full items-center gap-2 rounded-md text-left"
          >
            <IconChevronLeft className="h-3 w-3 text-muted-foreground" />
            <span>Settings</span>
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavMain
          title="Workspace"
          items={[
            { title: "Overview", url: `/${workspace.slug}/workspace/settings` },
            {
              title: "General",
              url: `/${workspace.slug}/settings/workspace/general`,
            },
            {
              title: "Members",
              url: `/${workspace.slug}/settings/workspace/members`,
            },
            {
              title: "Integrations",
              url: `/${workspace.slug}/settings/workspace/integrations`,
            },
          ]}
        />
        <SidebarNavMain
          title="User"
          items={[
            {
              title: "Profile",
              url: `/${workspace.slug}/settings/account/profile`,
            },
            {
              title: "API Keys",
              url: `/${workspace.slug}/settings/account/api`,
            },
          ]}
        />
      </SidebarContent>
    </Sidebar>
  );
};
