import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { StatusIcon } from "~/app/[workspaceSlug]/(appv2)/(deploy)/_components/deployments/environment-cell/StatusIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type DeploymentDirectoryCellProps = {
  directory: {
    path: string;
    environments: SCHEMA.Environment[];
  };
  deployment: SCHEMA.Deployment;
  systemSlug: string;
  release?: SCHEMA.DeploymentVersion;
};

export const DeploymentDirectoryCell: React.FC<
  DeploymentDirectoryCellProps
> = ({ directory, deployment, systemSlug, release }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { ref, inView } = useInView();

  const { data: releaseResult, isLoading: isReleaseLoading } =
    api.deployment.version.list.useQuery(
      { deploymentId: deployment.id, limit: 1 },
      {
        enabled: inView && directory.environments.length > 0 && release == null,
      },
    );

  const rel = release ?? releaseResult?.items[0];

  const { data: statusesResult, isLoading: isStatusesLoading } =
    api.deployment.version.status.bySystemDirectory.useQuery(
      { releaseId: rel?.id ?? "", directory: directory.path },
      { enabled: inView && rel != null },
    );
  const isLoading = isReleaseLoading || isStatusesLoading;

  const statuses = statusesResult ?? [];

  const getReleaseUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deployment.slug).release;

  return (
    <div className="flex w-full items-center justify-center" ref={ref}>
      {(!inView || isLoading) && (
        <div className="flex h-full w-full items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[16px] w-20 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>
      )}

      {inView && !isLoading && rel == null && (
        <p className="text-xs text-muted-foreground/70">No versions released</p>
      )}

      {inView && !isLoading && rel != null && (
        <div className="flex w-full items-center justify-between rounded-md p-2 hover:bg-secondary/50">
          <Link
            href={getReleaseUrl(rel.id).baseUrl()}
            className="flex w-full items-center gap-2"
          >
            <StatusIcon statuses={statuses.map((s) => s.job.status)} />
            <div className="w-full">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="max-w-36 truncate font-semibold">
                        <span className="whitespace-nowrap">{rel.version}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      {rel.version}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(rel.createdAt, "MMM d, hh:mm aa")}
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};
