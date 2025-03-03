"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import {
  IconDots,
  IconPlant,
  IconRocket,
  IconShip,
  IconTrash,
} from "@tabler/icons-react";
import _ from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { DeleteSystemDialog } from "~/app/[workspaceSlug]/(appv2)/_components/system/DeleteSystemDialog";
import { api } from "~/trpc/react";
import { SystemDeploymentSkeleton } from "./SystemDeploymentSkeleton";
import DeploymentTable from "./TableDeployments";

type System = SCHEMA.System & {
  deployments: SCHEMA.Deployment[];
};

export const SystemDeploymentTable: React.FC<{
  workspace: SCHEMA.Workspace;
  system: System;
}> = ({ workspace, system }) => {
  const { data: rootDirsResult, isLoading } =
    api.system.directory.listRoots.useQuery(system.id);
  if (isLoading) return <SystemDeploymentSkeleton />;

  const rootDirs = rootDirsResult?.directories ?? [];
  const rootEnvironments = rootDirsResult?.rootEnvironments ?? [];

  const numNestedEnvironments = _.sumBy(
    rootDirs,
    (dir) => dir.environments.length,
  );

  const numEnvironments = numNestedEnvironments + rootEnvironments.length;

  return (
    <div key={system.id} className="space-y-4">
      <div className="flex w-full items-center justify-between">
        <Link
          className="flex items-center gap-2 text-lg font-bold hover:text-blue-300"
          href={`/${workspace.slug}/systems/${system.slug}`}
        >
          {system.name}
        </Link>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 rounded-full font-normal text-muted-foreground"
                >
                  <IconRocket className="size-3" /> {system.deployments.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Deployments</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 rounded-full font-normal text-muted-foreground"
                >
                  <IconPlant className="size-3" /> {numEnvironments}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Environments</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <IconDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <CreateDeploymentDialog systemId={system.id}>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="flex items-center gap-2"
                >
                  <IconShip className="h-4 w-4" />
                  New Deployment
                </DropdownMenuItem>
              </CreateDeploymentDialog>
              <DeleteSystemDialog system={system}>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="flex items-center gap-2 text-red-500"
                >
                  <IconTrash className="h-4 w-4" />
                  Delete System
                </DropdownMenuItem>
              </DeleteSystemDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <DeploymentTable
          workspace={workspace}
          systemSlug={system.slug}
          environments={rootEnvironments}
          deployments={system.deployments}
          directories={rootDirs}
        />
      </div>
    </div>
  );
};
