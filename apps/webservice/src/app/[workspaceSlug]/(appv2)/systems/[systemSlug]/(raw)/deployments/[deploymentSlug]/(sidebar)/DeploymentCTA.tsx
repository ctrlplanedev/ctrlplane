"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseChannelDialog } from "./channels/CreateReleaseChannelDialog";
import { CreateReleaseDialog } from "./releases/CreateRelease";
import { CreateVariableDialog } from "./variables/CreateVariableDialog";

export const DeploymentCTA: React.FC<{
  deploymentId: string;
  systemId: string;
}> = ({ deploymentId, systemId }) => {
  const pathname = usePathname();
  const tab = pathname.split("/").pop();

  if (tab === "variables")
    return (
      <CreateVariableDialog deploymentId={deploymentId}>
        <Button variant="outline" className="flex items-center gap-2" size="sm">
          Add Variable
        </Button>
      </CreateVariableDialog>
    );

  if (tab === "releases")
    return (
      <CreateReleaseDialog deploymentId={deploymentId} systemId={systemId}>
        <Button variant="outline" className="flex items-center gap-2" size="sm">
          New Release
        </Button>
      </CreateReleaseDialog>
    );

  if (tab === "channels")
    return (
      <CreateReleaseChannelDialog deploymentId={deploymentId}>
        <Button variant="outline" className="flex items-center gap-2" size="sm">
          New Channel
        </Button>
      </CreateReleaseChannelDialog>
    );
  return null;
};
