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
  deploymentId?: string;
  systemId?: string;
}> = ({ workspaceId, deploymentId, systemId }) => {
  const [open, setOpen] = useState(false);
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
          <CreateSystemDialog workspaceId={workspaceId}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New System
            </DropdownMenuItem>
          </CreateSystemDialog>
          <CreateDeploymentDialog defaultSystemId={systemId}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New Deployment
            </DropdownMenuItem>
          </CreateDeploymentDialog>
          <CreateReleaseDialog
            deploymentId={deploymentId}
            systemId={systemId}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New Release
            </DropdownMenuItem>
          </CreateReleaseDialog>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Create Target
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem>Execute Runbook</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
