"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconReload,
} from "@tabler/icons-react";
import { format } from "date-fns";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { JobStatus } from "@ctrlplane/validators/jobs";

import {
  DropdownAction,
  ForceDeployVersionDialog,
  RedeployVersionDialog,
} from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { StatusIcon } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/environment-cell/StatusIcon";
import { urls } from "~/app/urls";

export const ActiveJobsCell: React.FC<{
  statuses: SCHEMA.JobStatus[];
  deploymentVersion: { id: string; tag: string; createdAt: Date };
  deployment: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
  system: { slug: string };
}> = ({ statuses, deploymentVersion, deployment, environment, system }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .release(deploymentVersion.id)
    .jobs();

  const hasActiveJobs = statuses.some((s) => s === JobStatus.InProgress);

  return (
    <div className="flex h-full w-full items-center justify-between p-1">
      <Link
        href={versionUrl}
        className="flex w-full items-center gap-2 rounded-md p-2"
      >
        <StatusIcon statuses={statuses} />
        <div className="flex flex-col">
          <div className="max-w-36 truncate font-semibold">
            {deploymentVersion.tag}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(deploymentVersion.createdAt, "MMM d, hh:mm aa")}
          </div>
        </div>
      </Link>
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
    </div>
  );
};
