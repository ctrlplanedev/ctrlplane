import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
  IconEye,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useCopyToClipboard } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { toast } from "@ctrlplane/ui/toast";

import type { Deployment } from "./types";
import { StatusIcon } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/environment-cell/StatusIcon";
import { urls } from "~/app/urls";
import { DeploymentExpanded } from "./DeploymentExpanded";

const useCopyJobId = (jobId: string) => {
  const [_, copyToClipboard] = useCopyToClipboard();

  return () => {
    copyToClipboard(jobId);
    toast.success("Job ID copied to clipboard");
  };
};

const JobCell: React.FC<{
  systemSlug: string;
  deploymentSlug: string;
  job: schema.Job;
  version: schema.DeploymentVersion;
}> = ({ systemSlug, deploymentSlug, job, version }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const deploymentUrls = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug);
  const deploymentBaseUrl = deploymentUrls.baseUrl();
  const versionUrl = deploymentUrls.release(version.id).baseUrl();

  const copyJobId = useCopyJobId(job.id);

  return (
    <div className="flex w-full items-center gap-2">
      <StatusIcon statuses={[job.status]} />
      <div className="flex flex-grow flex-col gap-0.5">
        <span className="text-sm font-medium">{version.name}</span>
        <span className="text-xs text-muted-foreground">
          {format(job.createdAt, "MMM d, hh:mm aa")}
        </span>
      </div>
      <div className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
            >
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom">
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Link
                href={deploymentBaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <IconExternalLink className="h-4 w-4" />
                View deployment
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Link
                href={versionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <IconExternalLink className="h-4 w-4" />
                View version
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                copyJobId();
              }}
              className="flex items-center gap-2"
            >
              <IconCopy className="h-4 w-4" />
              Copy job ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export const DeploymentCard: React.FC<{
  systemSlug: string;
  deployment: Deployment;
}> = ({ systemSlug, deployment }) => (
  <Card className="w-60 rounded-md">
    <CardHeader className="px-4 pb-0 pt-4">
      <CardTitle className="flex items-center justify-between">
        <span className="truncate">{deployment.name}</span>
        <DeploymentExpanded deployment={deployment} systemSlug={systemSlug}>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <IconEye className="h-4 w-4" />
          </Button>
        </DeploymentExpanded>
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4">
      {deployment.releaseTarget == null && (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <span>No release target</span>
        </div>
      )}
      {deployment.releaseTarget != null &&
        deployment.releaseTarget.version == null && (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <span>No version deployed</span>
          </div>
        )}
      {deployment.releaseTarget?.version != null && (
        <div className="flex items-center gap-2">
          <JobCell
            systemSlug={systemSlug}
            deploymentSlug={deployment.slug}
            job={deployment.releaseTarget.version.job}
            version={deployment.releaseTarget.version}
          />
        </div>
      )}
    </CardContent>
  </Card>
);
