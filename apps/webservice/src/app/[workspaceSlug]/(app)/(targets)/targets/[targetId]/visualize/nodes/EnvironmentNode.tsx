"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconPlant } from "@tabler/icons-react";
import _ from "lodash";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { JobStatus, JobStatusReadable } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";
import { ReleaseIcon } from "../../ReleaseCell";

type Environment = SCHEMA.Environment & {
  deployments: SCHEMA.Deployment[];
  resource: SCHEMA.Resource;
};

type EnvironmentNodeProps = NodeProps<{
  label: string;
  environment: Environment;
}>;

const DeploymentCard: React.FC<{
  deploymentName: string;
  job?: SCHEMA.Job;
  releaseVersion: string;
}> = ({ deploymentName, job, releaseVersion }) => (
  <div className="flex flex-grow items-center gap-12">
    <div>{deploymentName}</div>
    {job != null && (
      <div className="flex items-center gap-2">
        <ReleaseIcon job={job} />
        <div className="py-2 text-sm">
          <div>{releaseVersion}</div>
          <div>{JobStatusReadable[job.status]}</div>
        </div>
      </div>
    )}
    {job == null && (
      <div className="flex flex-grow justify-end py-2 pr-4 text-sm text-muted-foreground">
        No active job
      </div>
    )}
  </div>
);

export const EnvironmentNode: React.FC<EnvironmentNodeProps> = (node) => {
  const { data } = node;

  const latestActiveReleasesQ = api.deployment.byTargetId.useQuery(
    {
      resourceId: data.environment.resource.id,
      environmentIds: [data.environment.id],
      deploymentIds: data.environment.deployments.map((d) => d.id),
      jobsPerDeployment: 1,
      showAllStatuses: true,
    },
    { refetchInterval: 5_000 },
  );

  const latestActiveReleases = latestActiveReleasesQ.data ?? [];

  const isInProgress = latestActiveReleases.some(
    (r) => r.releaseJobTrigger?.job.status === JobStatus.InProgress,
  );
  const isPending = latestActiveReleases.some(
    (r) => r.releaseJobTrigger?.job.status === JobStatus.Pending,
  );
  const isCompleted = latestActiveReleases.every(
    (r) => r.releaseJobTrigger?.job.status === JobStatus.Completed,
  );

  return (
    <>
      <div
        className={cn(
          "relative flex min-w-[250px] flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4 py-3",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isCompleted && "border-green-500",
        )}
      >
        <div className="flex items-center gap-2">
          <IconPlant className="h-4 w-4 text-green-500" />
          <span>{data.label}</span>
        </div>
        <div className="flex flex-col gap-4">
          {latestActiveReleasesQ.isLoading &&
            _.range(3).map((i) => (
              <Skeleton
                key={i}
                className="h-9 w-full"
                style={{ opacity: 1 * (1 - i / 3) }}
              />
            ))}
          {!latestActiveReleasesQ.isLoading &&
            data.environment.deployments.map((deployment) => {
              const latestActiveRelease = latestActiveReleases.find(
                (r) =>
                  r.releaseJobTrigger?.release.deploymentId === deployment.id,
              );
              return (
                <DeploymentCard
                  key={deployment.id}
                  deploymentName={deployment.name}
                  job={latestActiveRelease?.releaseJobTrigger?.job}
                  releaseVersion={
                    latestActiveRelease?.releaseJobTrigger?.release.version ??
                    ""
                  }
                />
              );
            })}
        </div>
      </div>
      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800"
        position={Position.Right}
      />
    </>
  );
};
