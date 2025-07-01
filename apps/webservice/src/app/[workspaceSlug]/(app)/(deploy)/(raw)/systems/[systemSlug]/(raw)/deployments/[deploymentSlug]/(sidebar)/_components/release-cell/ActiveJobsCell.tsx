"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconPin,
  IconReload,
} from "@tabler/icons-react";
import { format } from "date-fns";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { DropdownAction } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { RedeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/RedeployVersionDialog";
import { StatusIcon } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/environment-cell/StatusIcon";
import { PinEnvToVersionDialog } from "../version-pinning/PinEnvToVersionDialog";
import { Cell } from "./Cell";
import { useDeploymentVersionEnvironmentContext } from "./DeploymentVersionEnvironmentContext";

const ActiveJobsDropdown: React.FC<{
  hasActiveJobs: boolean;
}> = ({ hasActiveJobs }) => {
  const { deployment, environment, deploymentVersion, isVersionPinned } =
    useDeploymentVersionEnvironmentContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
        >
          <IconDotsVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {!isVersionPinned && (
          <PinEnvToVersionDialog
            environment={environment}
            version={deploymentVersion}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <IconPin className="h-4 w-4" />
              Pin version
            </DropdownMenuItem>
          </PinEnvToVersionDialog>
        )}
        {!hasActiveJobs && (
          <DropdownAction
            deployment={deployment}
            environment={environment}
            icon={<IconReload className="h-4 w-4" />}
            label="Redeploy"
            Dialog={RedeployVersionDialog}
          />
        )}
        <DropdownAction
          deployment={deployment}
          environment={environment}
          icon={<IconAlertTriangle className="h-4 w-4" />}
          label="Force deploy"
          Dialog={ForceDeployVersionDialog}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ActiveJobsCell: React.FC<{
  statuses: SCHEMA.JobStatus[];
}> = ({ statuses }) => {
  const { deploymentVersion } = useDeploymentVersionEnvironmentContext();

  const hasActiveJobs = statuses.some((s) => s === JobStatus.InProgress);

  return (
    <Cell
      Icon={<StatusIcon statuses={statuses} />}
      label={format(deploymentVersion.createdAt, "MMM d, hh:mm aa")}
      Dropdown={<ActiveJobsDropdown hasActiveJobs={hasActiveJobs} />}
    />
  );
};
