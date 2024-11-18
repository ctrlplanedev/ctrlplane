"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { signOut } from "next-auth/react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuItem } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/react";
import { SearchDialog } from "../_components/SearchDialog";
import { AppSidebarCreateMenu } from "./AppSidebarCreateMenu";

const WorkspaceDropdown: React.FC<{
  workspace: Workspace;
  workspaces: Workspace[];
  viewer: { email: string };
}> = ({ workspace, workspaces, viewer }) => {
  const update = api.profile.update.useMutation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex w-full items-center justify-between gap-2 px-2 py-0 text-base"
        >
          <span className="truncate">{workspace.name}</span>
          <IconChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-neutral-900">
        <Link href={`/${workspace.slug}/settings/workspace/overview`}>
          <DropdownMenuItem>Workspace settings</DropdownMenuItem>
        </Link>
        <Link href={`/${workspace.slug}/settings/workspace/members`}>
          <DropdownMenuItem>Invite and manage users</DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Switch workspaces</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-[200px] bg-neutral-900">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {viewer.email}
              </DropdownMenuLabel>
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/${ws.slug}`}
                  passHref
                  onClick={() => update.mutate({ activeWorkspaceId: ws.id })}
                >
                  <DropdownMenuItem>
                    {ws.name}
                    {ws.id === workspace.id && (
                      <DropdownMenuShortcut>
                        <IconCheck className="h-4 w-4" />
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                </Link>
              ))}

              <DropdownMenuSeparator />
              <Link href={`/workspaces/create`} passHref>
                <DropdownMenuItem>Create or join workspace</DropdownMenuItem>
              </Link>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => signOut()}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const AppSidebarHeader: React.FC<{
  systems: System[];
  workspace: Workspace;
  workspaces: Workspace[];
  viewer: { email: string };
}> = ({ workspace, workspaces, viewer }) => {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2">
        <div className="flex-grow overflow-x-auto">
          <WorkspaceDropdown
            workspace={workspace}
            workspaces={workspaces}
            viewer={viewer}
          />
        </div>
        <SearchDialog>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <IconSearch className="h-4 w-4" />
          </Button>
        </SearchDialog>
        <AppSidebarCreateMenu workspace={workspace} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
