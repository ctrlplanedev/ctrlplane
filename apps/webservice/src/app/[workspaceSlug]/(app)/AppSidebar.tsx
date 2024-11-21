import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";

import { SidebarContent, SidebarHeader } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { AppSidebarSystem, AppSidebarWorkspace } from "./AppSidebarContent";
import { AppSidebarHeader } from "./AppSidebarHeader";
import { AppSidebarPopover } from "./AppSidebarPopover";
import { SidebarWithPopover } from "./AppSidebarPopoverContext";

export const AppSidebar: React.FC<{ workspace: Workspace }> = async ({
  workspace,
}) => {
  const [workspaces, viewer, systems] = await Promise.all([
    api.workspace.list(),
    api.user.viewer(),
    api.system.list({ workspaceId: workspace.id }),
  ]);

  return (
    <SidebarWithPopover>
      <AppSidebarPopover workspace={workspace} />
      <SidebarHeader>
        <AppSidebarHeader
          workspace={workspace}
          workspaces={workspaces}
          viewer={viewer}
          systems={systems.items}
        />
      </SidebarHeader>
      <SidebarContent>
        <AppSidebarWorkspace workspaceSlug={workspace.slug} />
        <AppSidebarSystem
          workspaceSlug={workspace.slug}
          systems={systems.items}
        />
      </SidebarContent>
    </SidebarWithPopover>
  );
};
