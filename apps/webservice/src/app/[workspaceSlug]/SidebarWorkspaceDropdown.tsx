"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
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

export const SidebarWorkspaceDropdown: React.FC = () => {
  const { data } = useSession();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaces = api.workspace.list.useQuery();
  const workspace = workspaces.data?.find((w) => w.slug === workspaceSlug);
  const update = api.profile.update.useMutation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 px-2 py-0 text-base"
        >
          {workspace?.name}
          <TbChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-neutral-900">
        <Link href={`/${workspaceSlug}/settings/workspace/overview`}>
          <DropdownMenuItem>Workspace settings</DropdownMenuItem>
        </Link>
        <Link href={`/${workspaceSlug}/settings/workspace/members`}>
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
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
