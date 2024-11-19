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

export const AppSidebarJobsPopover: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const { setActiveSidebarItem } = useSidebarPopover();
  const agents = api.job.agent.byWorkspaceId.useQuery(workspace.id);
  return (
    <>
      <SidebarHeader className="mt-1 px-3">Jobs</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Agents</SidebarGroupLabel>
          <SidebarMenu>
            {agents.data?.map((agent) => (
              <SidebarMenuItem key={agent.id}>
                <SidebarMenuButton asChild>
                  <Link
                    href={`/${workspace.slug}/job-agents/${agent.id}`}
                    onClick={() => setActiveSidebarItem(null)}
                  >
                    {agent.name}
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
