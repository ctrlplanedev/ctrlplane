"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconAlertCircle } from "@tabler/icons-react";

import { SidebarMenuButton } from "@ctrlplane/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { useSidebarPopover } from "./AppSidebarPopoverContext";

export const AppSidebarSystemPopover: React.FC<{
  systemId: string;
  workspace: Workspace;
}> = ({ workspace, systemId }) => {
  const system = api.system.byId.useQuery(systemId);
  const environments = api.environment.bySystemId.useQuery(systemId);
  const deployments = api.deployment.bySystemId.useQuery(systemId);
  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <div className="space-y-4 text-sm">
      <div className="text-lg font-semibold">{system.data?.name}</div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Environments
        </div>
        <div>
          {environments.data?.map(({ id, name }) => (
            <SidebarMenuButton key={id} asChild>
              <Link
                href={`/${workspace.slug}/systems/${system.data?.slug}/environments?environment_id=${id}`}
                onClick={() => setActiveSidebarItem(null)}
              >
                {name}
              </Link>
            </SidebarMenuButton>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Deployments
        </div>
        <div>
          {deployments.data?.map(({ id, name, slug, jobAgentId }) => (
            <SidebarMenuButton key={id} asChild>
              <Link
                href={`/${workspace.slug}/systems/${system.data?.slug}/deployments/${slug}`}
                onClick={() => setActiveSidebarItem(null)}
              >
                {name}{" "}
                {jobAgentId == null && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <IconAlertCircle className="size-3 text-red-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        No job agent configured for this deployment
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </Link>
            </SidebarMenuButton>
          ))}
        </div>
      </div>
    </div>
  );
};
