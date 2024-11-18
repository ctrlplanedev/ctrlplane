import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import {
  IconCategory,
  IconObjectScan,
  IconPlant,
  IconRocket,
  IconRun,
  IconShip,
  IconVariable,
} from "@tabler/icons-react";

import { SidebarContent, SidebarHeader } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { AppSidebarHeader } from "./AppSidebarHeader";
import { AppSidebarPopover } from "./AppSidebarPopover";
import { SidebarWithPopover } from "./AppSidebarPopoverContext";
import { SidebarNavMain } from "./SidebarNavMain";

const navMain = (prefix: string) => [
  {
    title: "Systems",
    url: `${prefix}/systems`,
    icon: IconCategory,
    isActive: true,
    items: [
      {
        title: "Dependencies",
        url: `${prefix}/dependencies`,
        isActive: true,
      },
    ],
  },
  {
    title: "Resources",
    url: `${prefix}/resources`,
    popoverId: "resources",
    icon: IconObjectScan,
    isActive: true,
    items: [
      {
        title: "List",
        url: `${prefix}/targets`,
      },
      {
        title: "Providers",
        url: `${prefix}/target-providers`,
      },
      {
        title: "Groups",
        url: `${prefix}/target-metadata-groups`,
      },
      {
        title: "Views",
        url: `${prefix}/target-views`,
      },
    ],
  },
  {
    title: "Jobs",
    url: "#",
    icon: IconRocket,
    items: [
      {
        title: "Agents",
        url: "#",
      },
      {
        title: "Runs",
        url: "#",
      },
    ],
  },
];

export const AppSidebar: React.FC<{ workspace: Workspace }> = async ({
  workspace,
}) => {
  const [workspaces, viewer, systems] = await Promise.all([
    api.workspace.list(),
    api.user.viewer(),
    api.system.list({ workspaceId: workspace.id }),
  ]);

  const navSystem = systems.items.map((s) => ({
    title: s.name,
    url: "#",
    isActive: true,
    items: [
      {
        title: "Environments",
        icon: IconPlant,
        url: "#",
      },
      {
        title: "Deployements",
        icon: IconShip,
        url: "#",
      },
      {
        title: "Runbooks",
        icon: IconRun,
        url: "#",
      },
      {
        title: "Variable Sets",
        icon: IconVariable,
        url: "#",
      },
    ],
  }));

  return (
    <SidebarWithPopover>
      <AppSidebarPopover />
      <SidebarHeader>
        <AppSidebarHeader
          workspace={workspace}
          workspaces={workspaces}
          viewer={viewer}
          systems={systems.items}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavMain
          title="Workspace"
          items={navMain(`/${workspace.slug}`)}
        />
        <SidebarNavMain title="Systems" items={navSystem} />
      </SidebarContent>
    </SidebarWithPopover>
  );
};
