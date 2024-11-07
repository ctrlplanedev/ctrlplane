"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/_components/CreateRelease";
import { api } from "~/trpc/react";
import { CreateReleaseChannelDialog } from "./release-channels/CreateReleaseChannelDialog";
import { CreateVariableDialog } from "./releases/CreateVariableDialog";

export const NavigationMenuAction: React.FC<{
  deploymentId: string;
  systemId: string;
}> = ({ deploymentId, systemId }) => {
  const pathname = usePathname();
  const isVariablesActive = pathname.includes("variables");
  const isReleaseChannelsActive = pathname.includes("release-channels");

  const releaseChannelsQ =
    api.deployment.releaseChannel.list.byDeploymentId.useQuery(deploymentId);
  const releaseChannels = releaseChannelsQ.data ?? [];

  return (
    <div>
      {isVariablesActive && (
        <CreateVariableDialog deploymentId={deploymentId}>
          <Button size="sm" variant="secondary">
            New Variable
          </Button>
        </CreateVariableDialog>
      )}

      {isReleaseChannelsActive && !releaseChannelsQ.isLoading && (
        <CreateReleaseChannelDialog
          deploymentId={deploymentId}
          releaseChannels={releaseChannels}
        >
          <Button size="sm" variant="secondary">
            New Release Channel
          </Button>
        </CreateReleaseChannelDialog>
      )}

      {!isVariablesActive && !isReleaseChannelsActive && (
        <CreateReleaseDialog deploymentId={deploymentId} systemId={systemId}>
          <Button size="sm" variant="secondary">
            New Release
          </Button>
        </CreateReleaseDialog>
      )}
    </div>
  );
};
