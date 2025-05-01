"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { usePathname } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { CreateDeploymentVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/CreateDeploymentVersion";
import { CreateHookDialog } from "../hooks/CreateHookDialog";
import { CreateVariableDialog } from "../variables/CreateVariableDialog";

export const DeploymentCTA: React.FC<{
  workspace: SCHEMA.Workspace;
  deploymentId: string;
  systemId: string;
  jobAgents: SCHEMA.JobAgent[];
}> = ({ workspace, deploymentId, systemId, jobAgents }) => {
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

  if (tab === "hooks")
    return (
      <CreateHookDialog
        deploymentId={deploymentId}
        jobAgents={jobAgents}
        workspace={workspace}
      >
        <Button variant="outline" className="flex items-center gap-2" size="sm">
          New Hook
        </Button>
      </CreateHookDialog>
    );
  return (
    <CreateDeploymentVersionDialog
      deploymentId={deploymentId}
      systemId={systemId}
    >
      <Button variant="outline" className="flex items-center gap-2" size="sm">
        New Version
      </Button>
    </CreateDeploymentVersionDialog>
  );
};
