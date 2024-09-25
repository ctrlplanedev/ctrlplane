"use client";

import type { System, Workspace } from "@ctrlplane/db/schema";
import { useParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { SearchDialog } from "./Search";
import { SidebarCreateMenu } from "./SidebarCreateMenu";
import { SidebarSystems } from "./SidebarSystems";
import { SidebarWorkspace } from "./SidebarWorkspace";
import { SidebarWorkspaceDropdown } from "./SidebarWorkspaceDropdown";

export const SidebarMain: React.FC<{
  workspace: Workspace;
  systems: System[];
}> = ({ workspace, systems }) => {
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

  return (
    <div className="space-y-8 text-sm">
      <div className="m-3 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-grow overflow-x-auto">
            <SidebarWorkspaceDropdown workspace={workspace} />
          </div>

          <SearchDialog>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
            >
              <IconSearch className="h-4 w-4" />
            </Button>
          </SearchDialog>

          <SidebarCreateMenu
            workspace={workspace}
            systemId={system.data?.id}
            deploymentId={deployment.data?.id}
          />
        </div>
      </div>

      <SidebarWorkspace />

      <SidebarSystems workspace={workspace} systems={systems} />
    </div>
  );
};
