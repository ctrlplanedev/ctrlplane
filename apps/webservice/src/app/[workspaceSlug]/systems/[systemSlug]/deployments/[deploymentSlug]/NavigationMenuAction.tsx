"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/_components/CreateRelease";
import { api } from "~/trpc/react";
import { CreateLifecycleHookDialog } from "./lifecycle-hooks/CreateLifecycleHookDialog";
import { CreateReleaseChannelDialog } from "./release-channels/CreateReleaseChannelDialog";
import { CreateVariableDialog } from "./releases/CreateVariableDialog";

export const NavigationMenuAction: React.FC<{
  deploymentId: string;
  systemId: string;
}> = ({ deploymentId, systemId }) => {
  const pathname = usePathname();
  const isVariablesActive = pathname.endsWith("variables");
  const isReleaseChannelsActive = pathname.endsWith("release-channels");
  const isLifecycleHooksActive = pathname.endsWith("lifecycle-hooks");

  const runbooksQ = api.runbook.bySystemId.useQuery(systemId);

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

      {isLifecycleHooksActive && (
        <CreateLifecycleHookDialog
          deploymentId={deploymentId}
          runbooks={runbooksQ.data ?? []}
        >
          <Button
            size="sm"
            variant="secondary"
            disabled={runbooksQ.isLoading}
            className="w-36"
          >
            {runbooksQ.isLoading && (
              <IconLoader2 className="h-3 w-3 animate-spin" />
            )}
            {!runbooksQ.isLoading && "New Lifecycle Hook"}
          </Button>
        </CreateLifecycleHookDialog>
      )}

      {!isVariablesActive &&
        !isReleaseChannelsActive &&
        !isLifecycleHooksActive && (
          <CreateReleaseDialog deploymentId={deploymentId} systemId={systemId}>
            <Button size="sm" variant="secondary">
              New Release
            </Button>
          </CreateReleaseDialog>
        )}
    </div>
  );
};
