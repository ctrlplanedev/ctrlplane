import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { JobStatus, JobStatusReadable } from "@ctrlplane/validators/jobs";

import { useJobDrawer } from "~/app/[workspaceSlug]/(app)/_components/job-drawer/useJobDrawer";
import { api } from "~/trpc/react";
import { ReleaseIcon } from "../../ReleaseCell";

type DeploymentNodeProps = NodeProps<{
  label: string;
  deployment: SCHEMA.Deployment;
  environment: SCHEMA.Environment;
  resource: SCHEMA.Resource;
}>;

export const DeploymentNode: React.FC<DeploymentNodeProps> = ({ data }) => {
  const { deployment, environment, resource } = data;
  const { setJobId } = useJobDrawer();

  const resourceId = resource.id;
  const environmentId = environment.id;
  const latestActiveReleasesQ =
    api.resource.activeReleases.byResourceAndEnvironmentId.useQuery(
      { resourceId, environmentId },
      { refetchInterval: 5_000 },
    );
  const latestActiveReleases = latestActiveReleasesQ.data ?? [];
  const activeRelease = latestActiveReleases.find(
    (r) => r.releaseJobTrigger.release.deploymentId === deployment.id,
  );

  const isInProgress = latestActiveReleases.some(
    (r) => r.releaseJobTrigger.job.status === JobStatus.InProgress,
  );
  const isPending = latestActiveReleases.some(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Pending,
  );
  const isCompleted = latestActiveReleases.every(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Completed,
  );

  const releaseJobTrigger = activeRelease?.releaseJobTrigger;

  return (
    <>
      <div
        className={cn(
          "relative flex w-[250px] flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4 py-1",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isCompleted && "border-green-500",
          releaseJobTrigger == null && "border-neutral-800",
          releaseJobTrigger != null && "cursor-pointer",
        )}
        onClick={() => {
          if (releaseJobTrigger != null) setJobId(releaseJobTrigger.job.id);
        }}
      >
        <div className="flex h-14 items-center">
          <div className="flex min-w-0 flex-1 flex-grow items-center gap-2">
            <span className="truncate">{deployment.name}</span>
          </div>
          {releaseJobTrigger != null && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <ReleaseIcon job={releaseJobTrigger.job} />
              <div className="text-sm">
                <div>{releaseJobTrigger.release.version}</div>
                <div>{JobStatusReadable[releaseJobTrigger.job.status]}</div>
              </div>
            </div>
          )}
          {releaseJobTrigger == null && (
            <div className="flex flex-shrink-0 justify-end pr-4 text-sm text-muted-foreground">
              No active job
            </div>
          )}
        </div>
      </div>
      <Handle
        type="target"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isCompleted && "border-green-500",
          releaseJobTrigger == null && "border-neutral-800",
        )}
        position={Position.Top}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isCompleted && "border-green-500",
          releaseJobTrigger == null && "border-neutral-800",
        )}
      />
    </>
  );
};
