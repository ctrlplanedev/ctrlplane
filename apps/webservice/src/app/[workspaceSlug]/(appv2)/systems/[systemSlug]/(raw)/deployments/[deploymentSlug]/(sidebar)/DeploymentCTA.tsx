"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { IconPlus, IconRocket } from "@tabler/icons-react";

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
        <Button variant="outline" className="flex items-center gap-2">
          <IconPlus className="h-4 w-4" />
          Add Variable
        </Button>
      </CreateVariableDialog>
    );

  if (tab === "releases")
    return (
      <CreateReleaseDialog deploymentId={deploymentId} systemId={systemId}>
        <Button variant="outline" className="flex items-center gap-2">
          <IconRocket className="h-4 w-4" />
          New Release
        </Button>
      </CreateReleaseDialog>
    );

  if (tab === "channels")
    return (
      <CreateReleaseChannelDialog deploymentId={deploymentId}>
        <Button variant="outline" className="flex items-center gap-2">
          <IconPlus className="h-4 w-4" />
          New Channel
        </Button>
      </CreateReleaseChannelDialog>
    );
  return null;
};
