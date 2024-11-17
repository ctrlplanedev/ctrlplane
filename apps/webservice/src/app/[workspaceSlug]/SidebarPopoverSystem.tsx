"use client";

import type { Workspace } from "@ctrlplane/db/schema";

import { api } from "~/trpc/react";
import { SidebarLink } from "./SidebarLink";

export const SidebarPopoverSystem: React.FC<{
  systemId: string;
  workspace: Workspace;
}> = ({ workspace, systemId }) => {
  const system = api.system.byId.useQuery(systemId);
  const environments = api.environment.bySystemId.useQuery(systemId);
  const deployments = api.deployment.bySystemId.useQuery(systemId);
  return (
    <div className="space-y-4 text-sm">
      <div className="text-lg font-semibold">{system.data?.name}</div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Environments
        </div>
        <div>
          {environments.data?.map(({ name }) => (
            <SidebarLink
              href={`/${workspace.slug}/systems/${system.data?.slug}/environments`}
            >
              {name}
            </SidebarLink>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Deployments
        </div>
        <div>
          {deployments.data?.map(({ id, name, slug }) => (
            <SidebarLink
              key={id}
              href={`/${workspace.slug}/systems/${system.data?.slug}/deployments/${slug}`}
            >
              {name}
            </SidebarLink>
          ))}
        </div>
      </div>
    </div>
  );
};
