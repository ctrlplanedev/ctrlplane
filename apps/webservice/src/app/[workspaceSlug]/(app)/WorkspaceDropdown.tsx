"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";

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

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

export const WorkspaceDropdown: React.FC<{
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
          className="flex w-56  items-center justify-between gap-2 px-3 py-0 text-left text-base"
        >
          <span className="flex-grow truncate">{workspace.name}</span>
          <IconChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-neutral-900">
        <Link
          href={urls.workspace(workspace.slug).workspaceSettings().baseUrl()}
        >
          <DropdownMenuItem>Workspace settings</DropdownMenuItem>
        </Link>
        <Link
          href={urls.workspace(workspace.slug).workspaceSettings().members()}
        >
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
                  href={urls.workspace(ws.slug).baseUrl()}
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
              <Link href="/workspaces/create" passHref>
                <DropdownMenuItem>Create or join workspace</DropdownMenuItem>
              </Link>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
