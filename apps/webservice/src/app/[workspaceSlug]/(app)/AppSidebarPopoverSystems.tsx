import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/react";
import { useSidebarPopover } from "./AppSidebarPopoverContext";

export const AppSidebarSystemsPopover: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const systems = api.system.list.useQuery({ workspaceId: workspace.id });
  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <>
      <SidebarHeader className="mt-1 px-3">Systems</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Systems</SidebarGroupLabel>
          <SidebarMenu>
            {systems.data?.items.map((system) => (
              <SidebarMenuItem key={system.id}>
                <SidebarMenuButton asChild>
                  <Link
                    href={`/${workspace.slug}/systems/${system.slug}`}
                    onClick={() => setActiveSidebarItem(null)}
                  >
                    {system.name}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
};
