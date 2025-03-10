"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { CreateSessionDialog } from "~/app/terminal/_components/CreateDialogSession";
import { api } from "~/trpc/react";
import { CreateDeploymentDialog } from "./_components/CreateDeployment";
import { CreateReleaseDialog } from "./_components/CreateRelease";
import { CreateResourceDialog } from "./_components/CreateResource";
import { CreateSystemDialog } from "./_components/CreateSystem";

export const AppSidebarCreateMenu: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const { deploymentSlug, workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
  }>();

  const system = api.system.bySlug.useQuery(
    { workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: systemSlug != null },
  );
  const deployment = api.deployment.bySlug.useQuery(
    {
      workspaceSlug,
      systemSlug: systemSlug ?? "",
      deploymentSlug: deploymentSlug ?? "",
    },
    { enabled: deploymentSlug != null && systemSlug != null },
  );

  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
        >
          <IconPlus className="h-4 w-4" />
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
          <CreateDeploymentDialog
            systemId={system.data?.id}
            onSuccess={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New Deployment
            </DropdownMenuItem>
          </CreateDeploymentDialog>
          <CreateReleaseDialog
            systemId={system.data?.id}
            deploymentId={deployment.data?.id}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              New Release
            </DropdownMenuItem>
          </CreateReleaseDialog>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem>Execute Runbook</DropdownMenuItem>
          <CreateSessionDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Remote Session
            </DropdownMenuItem>
          </CreateSessionDialog>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <CreateResourceDialog
            workspace={workspace}
            onSuccess={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Bootstrap Resource
            </DropdownMenuItem>
          </CreateResourceDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
