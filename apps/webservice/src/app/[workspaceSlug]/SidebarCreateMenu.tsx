import type { Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { TbPlus } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { CreateDeploymentDialog } from "./_components/CreateDeployment";
import { CreateReleaseDialog } from "./_components/CreateRelease";
import { CreateSystemDialog } from "./_components/CreateSystem";

export const SidebarCreateMenu: React.FC<{
  workspaceId: string;
  workspaceSlug: string;
  deploymentId?: string;
  systemId?: string;
}> = (props) => {
  const [open, setOpen] = useState(false);
  const workspace = {
    id: props.workspaceId,
    slug: props.workspaceSlug,
  } as Workspace;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
        >
          <TbPlus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-42 bg-neutral-900"
        align="center"
        forceMount
      >
        <DropdownMenuGroup>
          <CreateSystemDialog
            workspace={workspace}
            onSuccess={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New System
            </DropdownMenuItem>
          </CreateSystemDialog>
          <CreateDeploymentDialog {...props} onSuccess={() => setOpen(false)}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New Deployment
            </DropdownMenuItem>
          </CreateDeploymentDialog>
          <CreateReleaseDialog {...props} onClose={() => setOpen(false)}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New Release
            </DropdownMenuItem>
          </CreateReleaseDialog>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem>Execute Runbook</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
