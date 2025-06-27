"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { urls } from "~/app/urls";
import { LazyDeploymentVersionEnvironmentCell } from "./release-cell/DeploymentVersionEnvironmentCell";

const DateBadge: React.FC<{
  date: Date;
}> = ({ date }) => {
  return (
    <Badge
      variant="secondary"
      className="flex-shrink-0 text-xs hover:bg-secondary"
    >
      {formatDistanceToNowStrict(date, {
        addSuffix: true,
      })}
    </Badge>
  );
};

const StatusBadge: React.FC<{
  status: schema.DeploymentVersion["status"];
}> = ({ status }) => (
  <Badge
    variant="secondary"
    className={cn({
      "bg-green-500/20 text-green-500 hover:bg-green-500/20":
        status === DeploymentVersionStatus.Ready,
      "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20":
        status === DeploymentVersionStatus.Building,
      "bg-red-500/20 text-red-500 hover:bg-red-500/20":
        status === DeploymentVersionStatus.Failed,
      "bg-orange-500/20 text-orange-500 hover:bg-orange-500/20":
        status === DeploymentVersionStatus.Rejected,
    })}
  >
    {status}
  </Badge>
);

const StatusTooltip: React.FC<{
  status: schema.DeploymentVersion["status"];
  message: string | null;
}> = ({ status, message }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <StatusBadge status={status} />
      </TooltipTrigger>
      <TooltipContent
        align="start"
        className="bg-neutral-800 px-2 py-1 text-sm"
      >
        <span>
          {status}
          {message && `: ${message}`}
        </span>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const VersionRow: React.FC<{
  version: schema.DeploymentVersion;
  deployment: schema.Deployment;
  environments: schema.Environment[];
}> = ({ version, deployment, environments }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();
  const router = useRouter();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(version.id)
    .baseUrl();

  return (
    <TableRow
      key={version.id}
      className="cursor-pointer hover:bg-transparent"
      onClick={() => router.push(versionUrl)}
    >
      <TableCell className="sticky left-0 z-10 flex h-[70px] min-w-[400px] max-w-[750px] items-center gap-2 bg-background/95 py-0 pl-4 text-base">
        <span className="truncate">{version.name}</span>{" "}
        <DateBadge date={version.createdAt} />
        <StatusTooltip status={version.status} message={version.message} />
      </TableCell>
      {environments.map((env) => (
        <TableCell
          className="h-[70px] w-[220px] border-l px-2 py-0"
          onClick={(e) => e.stopPropagation()}
          key={env.id}
        >
          <LazyDeploymentVersionEnvironmentCell
            environment={env}
            deployment={deployment}
            deploymentVersion={version}
            system={{ id: deployment.systemId, slug: systemSlug }}
          />
        </TableCell>
      ))}
    </TableRow>
  );
};
