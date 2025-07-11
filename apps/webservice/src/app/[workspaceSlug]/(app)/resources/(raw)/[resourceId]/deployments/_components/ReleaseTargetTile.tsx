"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { capitalCase } from "change-case";

import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { api } from "~/trpc/react";
import { urls } from "../../../../../../../urls";

type ReleaseTarget = schema.ReleaseTarget & {
  deployment: schema.Deployment;
  resource: schema.Resource;
  environment: schema.Environment;
};

const EnvironmentRow: React.FC<{
  environment: schema.Environment;
}> = ({ environment }) => (
  <div className="flex items-center justify-between">
    <span>Environment:</span>
    <span>{environment.name}</span>
  </div>
);

const LatestVersionRow: React.FC<{
  releaseTargetId: string;
}> = ({ releaseTargetId }) => {
  const { data, isLoading } =
    api.releaseTarget.version.latest.useQuery(releaseTargetId);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex-shrink-0">Latest version:</span>
      {isLoading && <Skeleton className="h-5 w-20" />}
      {!isLoading && data == null && (
        <span className="min-w-0 truncate">No version found</span>
      )}
      {!isLoading && data != null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-60 truncate hover:underline">
                {data.tag}
              </span>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                Tag: <span className="font-mono">{data.tag}</span>
              </span>
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                Name: <span className="font-mono">{data.name}</span>
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

const InProgressVersionRow: React.FC<{
  releaseTargetId: string;
}> = ({ releaseTargetId }) => {
  const { data, isLoading } = api.releaseTarget.version.inProgress.useQuery(
    releaseTargetId,
    { refetchInterval: 5_000 },
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex-shrink-0">Deploying:</span>
      {isLoading && <Skeleton className="h-5 w-20" />}
      {!isLoading && data == null && (
        <span className="min-w-0 truncate">No active release</span>
      )}
      {!isLoading && data != null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex max-w-60 items-center gap-2 truncate">
                <JobTableStatusIcon status={data.job.status} />
                {data.version.tag}
              </div>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                Tag: <span className="font-mono">{data.version.tag}</span>
              </span>
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                Name: <span className="font-mono">{data.version.name}</span>
              </span>
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                Status:{" "}
                <JobTableStatusIcon
                  status={data.job.status}
                  className="h-3 w-3"
                />{" "}
                {capitalCase(data.job.status)}{" "}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export const ReleaseTargetTile: React.FC<{
  releaseTarget: ReleaseTarget;
}> = ({ releaseTarget }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const releaseTargetPageUrl = urls
    .workspace(workspaceSlug)
    .resource(releaseTarget.resource.id)
    .deployments()
    .releaseTarget(releaseTarget.id)
    .baseUrl();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{releaseTarget.deployment.name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <EnvironmentRow {...releaseTarget} />
            <LatestVersionRow releaseTargetId={releaseTarget.id} />
            <InProgressVersionRow releaseTargetId={releaseTarget.id} />
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm">
              Lock
            </Button>
            <Link
              className={buttonVariants({ variant: "default", size: "sm" })}
              href={releaseTargetPageUrl}
            >
              Deploy
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
