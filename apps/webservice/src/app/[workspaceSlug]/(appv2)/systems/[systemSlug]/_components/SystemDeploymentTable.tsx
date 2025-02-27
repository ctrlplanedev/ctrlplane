"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconDots, IconShip, IconTrash } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/CreateDeployment";
import { api } from "~/trpc/react";
import { DeleteSystemDialog } from "./DeleteSystemDialog";
import DeploymentTable from "./TableDeployments";

export const SystemDeploymentTable: React.FC<{
  workspace: Workspace;
  system: System;
}> = ({ workspace, system }) => {
  const { ref, inView } = useInView();
  const environments = api.environment.bySystemId.useQuery(system.id, {
    enabled: inView,
  });
  const deployments = api.deployment.bySystemId.useQuery(system.id, {
    enabled: inView,
  });

  return (
    <div key={system.id} className="space-y-4">
      <div className="flex w-full items-center justify-between">
        <Link
          className="flex items-center gap-2 text-lg font-bold hover:text-blue-300"
          href={`/${workspace.slug}/systems/${system.slug}`}
        >
          {system.name}
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

      <div ref={ref} className="overflow-hidden rounded-md border">
        <DeploymentTable
          workspace={workspace}
          systemSlug={system.slug}
          environments={environments.data ?? []}
          deployments={deployments.data ?? []}
        />
      </div>
    </div>
  );
};
