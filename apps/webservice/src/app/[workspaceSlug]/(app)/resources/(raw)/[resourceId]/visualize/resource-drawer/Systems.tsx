import type * as schema from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { ResourceInformation } from "../types";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type Job = {
  id: string;
  status: string;
  createdAt: Date;
  metadata: Record<string, string>;
};

type Version = {
  id: string;
  name: string;
  tag: string;
  job: Job;
};

type Deployment = schema.Deployment & { version: Version | null };

type System = schema.System & {
  environment: schema.Environment;
  deployments: Deployment[];
};

const JobLinks: React.FC<{
  job: Job;
}> = ({ job }) => {
  const { metadata } = job;
  const links =
    metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : ({} as Record<string, string>);

  if (Object.keys(links).length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {Object.entries(links).map(([key, value]) => (
        <Link
          key={key}
          href={value}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex h-6 cursor-pointer items-center gap-2 px-1.5 text-xs",
          )}
        >
          <IconExternalLink className="h-3 w-3" />
          {key}
        </Link>
      ))}
    </div>
  );
};

const DeploymentSection: React.FC<{
  deployment: Deployment;
}> = ({ deployment }) => {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">{deployment.name}</div>
      <div className="mx-4 flex-grow border-t border-muted-foreground/20" />
      {deployment.version != null && (
        <div className="flex items-center gap-2">
          <JobLinks job={deployment.version.job} />
          <JobTableStatusIcon
            status={deployment.version.job.status as JobStatus}
            className="h-4 w-4"
          />
          {deployment.version.tag}
        </div>
      )}
      {deployment.version == null && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">No version</span>
        </div>
      )}
    </div>
  );
};

const SystemSection: React.FC<{
  system: System;
}> = ({ system }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const systemUrls = urls.workspace(workspaceSlug).system(system.slug);
  const environmentUrl = systemUrls
    .environment(system.environment.id)
    .baseUrl();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-6">
          <span className="text-lg font-semibold">
            <Link
              href={systemUrls.baseUrl()}
              className="cursor-pointer hover:underline"
            >
              {system.name}
            </Link>
            {" / "}
            <Link
              href={environmentUrl}
              className="cursor-pointer hover:underline"
            >
              {system.environment.name}
            </Link>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {system.deployments.map((deployment) => (
          <DeploymentSection key={deployment.id} deployment={deployment} />
        ))}
      </CardContent>
    </Card>
  );
};

const SkeletonCard: React.FC = () => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle>
        <Skeleton className="h-4 w-24" />
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </CardContent>
  </Card>
);

export const ResourceDrawerSystems: React.FC<{
  resource: ResourceInformation;
}> = ({ resource }) => {
  const { data, isLoading } = api.resource.allSystemsOverview.useQuery(
    resource.id,
  );

  return (
    <div className="w-full space-y-8 p-6">
      <h2 className="text-2xl font-semibold">Systems</h2>
      {isLoading && <SkeletonCard />}
      {!isLoading &&
        data?.map((system) => (
          <SystemSection key={system.id} system={system} />
        ))}
    </div>
  );
};
