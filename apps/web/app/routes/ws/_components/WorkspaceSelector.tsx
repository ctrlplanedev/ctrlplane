import { Check, ChevronDown } from "lucide-react";
import { NavLink } from "react-router";

import { Button } from "~/components/ui/button";
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
} from "~/components/ui/dropdown-menu";

export const WorkspaceSelector: React.FC<{
  viewer: { email: string };
  activeWorkspaceId?: string | null;
  workspaces: Array<{ id: string; slug: string; name: string }>;
}> = ({ viewer, activeWorkspaceId, workspaces }) => {
  const workspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces.at(0);
  if (workspace == null) return;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex w-56 items-center justify-between gap-2 px-3 py-0 text-left text-base"
        >
          <span className="flex-grow truncate">{workspace.name}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <NavLink to={`/workspaces/${workspace.slug}/settings`}>
          <DropdownMenuItem>Workspace settings</DropdownMenuItem>
        </NavLink>
        <NavLink to={`/workspaces/${workspace.slug}/members`}>
          <DropdownMenuItem>Invite and manage users</DropdownMenuItem>
        </NavLink>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Switch workspaces</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-[200px]">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {viewer.email}
              </DropdownMenuLabel>
              {workspaces.map((ws) => (
                <NavLink key={ws.id} to={`/${ws.slug}`}>
                  <DropdownMenuItem>
                    {ws.name}
                    {ws.id === workspace.id && (
                      <DropdownMenuShortcut>
                        <Check className="h-4 w-4" />
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                </NavLink>
              ))}

              <DropdownMenuSeparator />
              <NavLink to="/workspaces/create">
                <DropdownMenuItem>Create or join workspace</DropdownMenuItem>
              </NavLink>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
