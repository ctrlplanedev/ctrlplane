import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";
import { capitalCase } from "change-case";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import type {
  DeploymentVersionWithJob,
  ReleaseTargetModuleInfo,
} from "./release-target-module-info";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";

const EnvironmentRow: React.FC<{
  environment: schema.Environment;
}> = ({ environment }) => (
  <div className="flex items-center justify-between">
    <span>Environment:</span>
    <span>{environment.name}</span>
  </div>
);

const ResourceRow: React.FC<{
  resource: schema.Resource;
}> = ({ resource }) => (
  <div className="flex items-center justify-between">
    <span>Resource:</span>
    <span>{resource.name}</span>
  </div>
);

const DeploymentRow: React.FC<{
  deployment: schema.Deployment;
}> = ({ deployment }) => (
  <div className="flex items-center justify-between">
    <span>Deployment:</span>
    <span>{deployment.name}</span>
  </div>
);

const VersionRow: React.FC<{
  deploymentVersion: DeploymentVersionWithJob;
}> = ({ deploymentVersion }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="flex-shrink-0">Current version:</span>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex max-w-60 items-center gap-2 truncate">
            <JobTableStatusIcon status={deploymentVersion.job.status} />
            {deploymentVersion.tag}
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2 text-muted-foreground">
            Tag: <span className="font-mono">{deploymentVersion.tag}</span>
          </span>
          <span className="flex items-center justify-between gap-2 text-muted-foreground">
            Name: <span className="font-mono">{deploymentVersion.name}</span>
          </span>
          <span className="flex items-center justify-between gap-2 text-muted-foreground">
            Status:{" "}
            <JobTableStatusIcon
              status={deploymentVersion.job.status}
              className="h-3 w-3"
            />{" "}
            {capitalCase(deploymentVersion.job.status)}{" "}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

const JobRow: React.FC<{
  deploymentVersion: DeploymentVersionWithJob;
}> = ({ deploymentVersion }) => {
  const { job } = deploymentVersion;
  const { links } = job;
  const linksArray = Object.entries(links);

  return (
    <div className="flex items-center justify-between">
      <span>Job:</span>
      {linksArray.length === 0 && (
        <span className="text-muted-foreground">No links</span>
      )}
      {linksArray.length > 0 && (
        <div className="flex items-center gap-1">
          {linksArray.map(([key, url]) => (
            <Link
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex h-6 items-center gap-1 text-xs",
              )}
            >
              <IconExternalLink className="h-3 w-3" />
              {key}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const ReleaseTargetSummary: React.FC<{
  releaseTarget: ReleaseTargetModuleInfo;
}> = ({ releaseTarget }) => (
  <div className="flex w-full flex-col gap-2 text-sm">
    <ResourceRow resource={releaseTarget.resource} />
    <EnvironmentRow {...releaseTarget} />
    <DeploymentRow {...releaseTarget} />
    {releaseTarget.deploymentVersion != null && (
      <>
        <VersionRow deploymentVersion={releaseTarget.deploymentVersion} />
        <JobRow deploymentVersion={releaseTarget.deploymentVersion} />
      </>
    )}
  </div>
);
