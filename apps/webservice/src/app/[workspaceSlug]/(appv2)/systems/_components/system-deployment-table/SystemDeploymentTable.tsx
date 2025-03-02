"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconDots, IconShip, IconTrash } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { DeleteSystemDialog } from "~/app/[workspaceSlug]/(appv2)/_components/system/DeleteSystemDialog";
import DeploymentTable from "./TableDeployments";

type System = SCHEMA.System & {
  deployments: SCHEMA.Deployment[];
  environments: SCHEMA.Environment[];
};

export const SystemDeploymentTable: React.FC<{
  workspace: SCHEMA.Workspace;
  system: System;
}> = ({ workspace, system }) => {
  return (
    <div key={system.id} className="space-y-4">
      <div className="flex w-full items-center justify-between">
        <Link
          className="flex items-center gap-2 text-lg font-bold hover:text-blue-300"
          href={`/${workspace.slug}/systems/${system.slug}`}
        >
          {system.name}
          <Badge variant="secondary" className="rounded-full">
            {system.deployments.length}
          </Badge>
        </Link>

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

      <div className="overflow-hidden rounded-md border">
        <DeploymentTable
          workspace={workspace}
          systemSlug={system.slug}
          environments={system.environments}
          deployments={system.deployments}
        />
      </div>
    </div>
  );
};
