"use client";

import React from "react";
import { useParams, usePathname } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/(app)/_components/CreateRelease";
import { api } from "~/trpc/react";
import { CreateHookDialog } from "./hooks/CreateHookDialog";
import { CreateReleaseChannelDialog } from "./release-channels/CreateReleaseChannelDialog";
import { CreateVariableDialog } from "./releases/CreateVariableDialog";

export const NavigationMenuAction: React.FC<{
  deploymentId: string;
  systemId: string;
}> = ({ deploymentId, systemId }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const pathname = usePathname();
  const isVariablesActive = pathname.includes("variables");
  const isReleaseChannelsActive = pathname.includes("release-channels");
  const isHooksActive = pathname.includes("hooks");

  const releaseChannelsQ =
    api.deployment.releaseChannel.list.byDeploymentId.useQuery(deploymentId);
  const releaseChannels = releaseChannelsQ.data ?? [];

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const jobAgentsQ = api.job.agent.byWorkspaceId.useQuery(workspace?.id ?? "", {
    enabled: workspace != null,
  });
  const jobAgents = jobAgentsQ.data ?? [];

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

      {isHooksActive && workspace != null && (
        <CreateHookDialog
          deploymentId={deploymentId}
          jobAgents={jobAgents}
          workspace={workspace}
        >
          <Button size="sm" variant="secondary">
            New Hook
          </Button>
        </CreateHookDialog>
      )}

      {!isVariablesActive && !isReleaseChannelsActive && !isHooksActive && (
        <CreateReleaseDialog deploymentId={deploymentId} systemId={systemId}>
          <Button size="sm" variant="secondary">
            New Release
          </Button>
        </CreateReleaseDialog>
      )}
    </div>
  );
};
