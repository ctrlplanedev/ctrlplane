"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/_components/CreateRelease";
import { CreateReleaseChannelDialog } from "./release-channels/CreateReleaseChannelDialog";
import { CreateVariableDialog } from "./releases/CreateVariableDialog";

export const NavigationMenuAction: React.FC<{
  deploymentId: string;
  systemId: string;
}> = ({ deploymentId, systemId }) => {
  const pathname = usePathname();
  const isVariablesActive = pathname.includes("variables");
  const isReleaseChannelsActive = pathname.includes("release-channels");

  return (
    <div>
      {isVariablesActive && (
        <CreateVariableDialog deploymentId={deploymentId}>
          <Button size="sm" variant="secondary">
            New Variable
          </Button>
        </CreateVariableDialog>
      )}

      {isReleaseChannelsActive && (
        <CreateReleaseChannelDialog deploymentId={deploymentId}>
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
