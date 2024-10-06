"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/_components/CreateRelease";
import { CreateVariableDialog } from "./releases/CreateVariableDialog";

export const NavigationMenuAction: React.FC<{
  deploymentId: string;
  systemId: string;
}> = ({ deploymentId, systemId }) => {
  const pathname = usePathname();
  const isVariablesActive = pathname.includes("variables");

  return (
    <div>
      {isVariablesActive && (
        <CreateVariableDialog deploymentId={deploymentId}>
          <Button size="sm" variant="secondary">
            New Variable
          </Button>
        </CreateVariableDialog>
      )}

      {!isVariablesActive && (
        <CreateReleaseDialog deploymentId={deploymentId} systemId={systemId}>
          <Button size="sm" variant="secondary">
            New Release
          </Button>
        </CreateReleaseDialog>
      )}
    </div>
  );
};
