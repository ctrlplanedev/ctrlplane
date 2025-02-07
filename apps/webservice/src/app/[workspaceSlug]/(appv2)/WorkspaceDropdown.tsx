import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconChevronDown } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

export const WorkspaceDropdown: React.FC<{
  workspace: Workspace;
  workspaces: Workspace[];
}> = ({ workspace }) => {
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
        <Link href={`/${workspace.slug}/settings/workspace/overview`}>
          <DropdownMenuItem>Workspace settings</DropdownMenuItem>
        </Link>
        <Link href={`/${workspace.slug}/settings/workspace/members`}>
          <DropdownMenuItem>Invite and manage users</DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
