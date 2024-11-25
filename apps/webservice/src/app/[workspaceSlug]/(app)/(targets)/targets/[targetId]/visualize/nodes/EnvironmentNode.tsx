"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { IconPlant } from "@tabler/icons-react";
import _ from "lodash";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { JobStatus, JobStatusReadable } from "@ctrlplane/validators/jobs";

import { useJobDrawer } from "~/app/[workspaceSlug]/(app)/_components/job-drawer/useJobDrawer";
import { api } from "~/trpc/react";
import { ReleaseIcon } from "../../ReleaseCell";

type Env = NonNullable<
  RouterOutputs["resource"]["relationships"][number]
>["workspace"]["systems"][number]["environments"][number];

type Environment = Env & {
  deployments: SCHEMA.Deployment[];
};

type EnvironmentNodeProps = NodeProps<{
  label: string;
  environment: Environment;
}>;

const DeploymentCard: React.FC<{
  deploymentName: string;
  job?: SCHEMA.Job;
  releaseVersion: string;
}> = ({ deploymentName, job, releaseVersion }) => {
  const { setJobId } = useJobDrawer();
  return (
    <>
      <div
        className={cn(
          "flex h-14 w-72 flex-grow items-center gap-12 rounded-md border  border-neutral-800 px-4 py-3",
          job != null && "cursor-pointer hover:bg-neutral-900/50",
        )}
        onClick={() => {
          if (job != null) setJobId(job.id);
        }}
      >
        <span className="flex-grow truncate">{deploymentName}</span>
        {job != null && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <ReleaseIcon job={job} />
            <div className="py-2 text-sm">
              <div>{releaseVersion}</div>
              <div>{JobStatusReadable[job.status]}</div>
            </div>
          </div>
        )}
        {job == null && (
          <div className="flex flex-shrink-0 flex-grow justify-end py-2 pr-4 text-sm text-muted-foreground">
            No active job
          </div>
        )}
      </div>
    </>
  );
};

export const EnvironmentNode: React.FC<EnvironmentNodeProps> = (node) => {
  const { data } = node;

  const resourceId = data.environment.resource.id;
  const environmentId = data.environment.id;
  const latestActiveReleasesQ =
    api.resource.activeReleases.byResourceAndEnvironmentId.useQuery(
      { resourceId, environmentId },
      // { refetchInterval: 5_000 },
    );

  const latestActiveReleases = latestActiveReleasesQ.data ?? [];

  const isInProgress = latestActiveReleases.some(
    (r) => r.releaseJobTrigger.job.status === JobStatus.InProgress,
  );
  const isPending = latestActiveReleases.some(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Pending,
  );
  const isCompleted = latestActiveReleases.every(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Completed,
  );

  const numDeployments = data.environment.deployments.length;

  return (
    <>
      <div
        className={cn(
          "relative flex min-w-[250px] flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4 pb-4 pt-3",
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
            _.range(numDeployments).map((i) => (
              <Skeleton
                key={i}
                className="h-14 w-72"
                style={{ opacity: 1 * (1 - i / numDeployments) }}
              />
            ))}
          {!latestActiveReleasesQ.isLoading &&
            data.environment.deployments.map((deployment) => {
              const latestActiveRelease = latestActiveReleases.find(
                (r) =>
                  r.releaseJobTrigger.release.deploymentId === deployment.id,
              );
              return (
                <DeploymentCard
                  key={deployment.id}
                  deploymentName={deployment.name}
                  job={latestActiveRelease?.releaseJobTrigger.job}
                  releaseVersion={
                    latestActiveRelease?.releaseJobTrigger.release.version ?? ""
                  }
                />
              );
            })}
        </div>
      </div>
      <Handle
        type="target"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isCompleted && "border-green-500",
        )}
        position={Position.Left}
      />
      {data.environment.deployments.map((deployment, index) => {
        // position handles vertically: header (+ extra accounting for padding) +
        // (card height + gap) * index + half card height for centering
        const topOffset = 44 + (56 + 16) * index + 56 / 2;
        const latestActiveRelease = data.environment.latestActiveRelease.find(
          (r) => r.releaseJobTrigger.release.deploymentId === deployment.id,
        );
        console.log({
          latestActiveReleaseJobId:
            latestActiveRelease?.releaseJobTrigger.job.id,
        });
        return (
          <Handle
            key={deployment.id}
            id={latestActiveRelease?.releaseJobTrigger.job.id}
            type="source"
            className={cn(
              "h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800",
              isInProgress && "border-blue-500",
              isPending && "border-neutral-500",
              isCompleted && "border-green-500",
            )}
            position={Position.Right}
            style={{ top: topOffset }}
          />
        );
      })}
    </>
  );
};
