"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useParams } from "next/navigation";
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
import { urls } from "~/app/urls";
import { PinEnvToVersionDialog } from "../version-pinning/PinEnvToVersionDialog";
import { Cell } from "./Cell";

const ActiveJobsDropdown: React.FC<{
  deployment: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
  version: { id: string; tag: string };
  hasActiveJobs: boolean;
  isVersionPinned?: boolean;
}> = ({ deployment, environment, version, hasActiveJobs, isVersionPinned }) => (
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
        <PinEnvToVersionDialog environment={environment} version={version}>
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

export const ActiveJobsCell: React.FC<{
  statuses: SCHEMA.JobStatus[];
  deploymentVersion: { id: string; tag: string; createdAt: Date };
  deployment: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
  system: { slug: string };
  isVersionPinned?: boolean;
}> = ({
  statuses,
  deploymentVersion,
  deployment,
  environment,
  system,
  isVersionPinned,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .release(deploymentVersion.id)
    .jobs();

  const hasActiveJobs = statuses.some((s) => s === JobStatus.InProgress);

  return (
    <Cell
      Icon={<StatusIcon statuses={statuses} />}
      url={versionUrl}
      tag={deploymentVersion.tag}
      label={format(deploymentVersion.createdAt, "MMM d, hh:mm aa")}
      isVersionPinned={isVersionPinned}
      Dropdown={
        <ActiveJobsDropdown
          deployment={deployment}
          environment={environment}
          version={deploymentVersion}
          hasActiveJobs={hasActiveJobs}
          isVersionPinned={isVersionPinned}
        />
      }
    />
  );
};
