"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconAlertCircle, IconLock } from "@tabler/icons-react";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@ctrlplane/ui/sidebar";
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
  const runbooks = api.runbook.bySystemId.useQuery(systemId);
  const variableSets = api.variableSet.bySystemId.useQuery(systemId);

  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <>
      <SidebarHeader className="mt-1 px-3">
        {system.data?.name ?? "System"}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Environments</SidebarGroupLabel>
          <SidebarMenu>
            {environments.data?.map(({ id, name, policyId }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton asChild>
                  <Link
                    href={`/${workspace.slug}/systems/${system.data?.slug}/environments?environment_id=${id}`}
                    onClick={() => setActiveSidebarItem(null)}
                    className="flex flex-grow items-center gap-1"
                  >
                    {name}
                  </Link>
                </SidebarMenuButton>

                <SidebarMenuAction>
                  <Link
                    href={`/${workspace.slug}/systems/${system.data?.slug}/environments?environment_policy_id=${policyId}`}
                    onClick={() => setActiveSidebarItem(null)}
                    className="flex items-center gap-1 "
                  >
                    <IconLock className="size-4 text-muted-foreground" />
                  </Link>
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Deployments</SidebarGroupLabel>
          <SidebarMenu>
            {deployments.data?.map(({ id, name, slug, jobAgentId }) => (
              <SidebarMenuButton key={id} asChild>
                <Link
                  href={`/${workspace.slug}/systems/${system.data?.slug}/deployments/${slug}/releases`}
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
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Runbooks</SidebarGroupLabel>
          <SidebarMenu>
            {runbooks.data?.length === 0 && runbooks.isSuccess && (
              <div className="rounded-md px-2 text-xs text-neutral-600">
                No runbooks found.
              </div>
            )}
            {runbooks.data?.map(({ id, name }) => (
              <SidebarMenuButton key={id} asChild>
                <Link
                  href={`/${workspace.slug}/systems/${system.data?.slug}/runbooks/${id}`}
                  onClick={() => setActiveSidebarItem(null)}
                >
                  {name}
                </Link>
              </SidebarMenuButton>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Variable Sets</SidebarGroupLabel>
          <SidebarMenu>
            {variableSets.data?.length === 0 && variableSets.isSuccess && (
              <div className="rounded-md px-2 text-xs text-neutral-600">
                No variable sets found.
              </div>
            )}
            {variableSets.data?.map(({ id, name }) => (
              <SidebarMenuButton key={id} asChild>
                <Link
                  href={`/${workspace.slug}/systems/${system.data?.slug}/variable-sets/${id}`}
                  onClick={() => setActiveSidebarItem(null)}
                >
                  {name}
                </Link>
              </SidebarMenuButton>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
};
