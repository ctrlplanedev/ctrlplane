"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { TbCheck, TbChevronDown } from "react-icons/tb";

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

import { api } from "~/trpc/react";

export const SidebarWorkspaceDropdown: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const { data } = useSession();
  const workspaces = api.workspace.list.useQuery();
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
          <TbChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
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
                {data?.user.email}
              </DropdownMenuLabel>
              {workspaces.data?.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/${ws.slug}`}
                  passHref
                  onClick={() => update.mutate({ activeWorkspaceId: ws.id })}
                >
                  <DropdownMenuItem>
                    {ws.name}
                    {ws.id === workspace?.id && (
                      <DropdownMenuShortcut>
                        <TbCheck />
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
