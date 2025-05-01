"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconDots,
  IconLoader2,
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

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/CreateDeployment";
import { DeleteSystemDialog } from "~/app/[workspaceSlug]/(app)/_components/system/DeleteSystemDialog";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import DeploymentTable from "./TableDeployments";

type System = SCHEMA.System & {
  deployments: SCHEMA.Deployment[];
};

const DeploymentsTooltip: React.FC<{
  numDeployments: number;
}> = ({ numDeployments }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const deploymentsUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployments();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Link href={deploymentsUrl} target="_blank" rel="noopener noreferrer">
            <Badge
              variant="outline"
              className="flex items-center gap-1 rounded-full font-normal text-muted-foreground"
            >
              <IconRocket className="size-3" /> {numDeployments}
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Deployments</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const EnvironmentsTooltip: React.FC<{
  systemId: string;
}> = ({ systemId }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const environmentsUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .environments();

  const { data: rootDirsResult, isLoading } =
    api.system.directory.listRoots.useQuery(systemId);

  const rootDirs = rootDirsResult?.directories ?? [];
  const rootEnvironments = rootDirsResult?.rootEnvironments ?? [];

  const numNestedEnvironments = _.sumBy(
    rootDirs,
    (dir) => dir.environments.length,
  );

  const numEnvironments = numNestedEnvironments + rootEnvironments.length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Link
            href={environmentsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Badge
              variant="outline"
              className="flex items-center gap-1 rounded-full font-normal text-muted-foreground"
            >
              <IconPlant className="size-3" />{" "}
              {isLoading && <IconLoader2 className="h-2 w-2 animate-spin" />}
              {!isLoading && numEnvironments}
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Environments</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const SystemDropdownMenu: React.FC<{
  system: System;
}> = ({ system }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-6 w-6">
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
);

export const SystemDeploymentTable: React.FC<{
  workspace: SCHEMA.Workspace;
  system: System;
}> = ({ workspace, system }) => {
  const systemUrls = urls.workspace(workspace.slug).system(system.slug);
  return (
    <div key={system.id} className="space-y-4">
      <div className="flex w-full items-center justify-between">
        <Link
          className="flex items-center gap-2 text-lg font-bold hover:text-blue-300"
          href={systemUrls.baseUrl()}
        >
          {system.name}
        </Link>
        <div className="flex items-center gap-2">
          <DeploymentsTooltip numDeployments={system.deployments.length} />
          <EnvironmentsTooltip systemId={system.id} />
          <SystemDropdownMenu system={system} />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <DeploymentTable workspace={workspace} system={system} />
      </div>
    </div>
  );
};
