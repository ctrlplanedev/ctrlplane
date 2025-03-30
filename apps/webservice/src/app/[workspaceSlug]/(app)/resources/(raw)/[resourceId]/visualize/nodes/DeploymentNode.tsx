import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconClock,
  IconLoader2,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { JobStatus, JobStatusReadable } from "@ctrlplane/validators/jobs";

import { useDeploymentEnvResourceDrawer } from "~/app/[workspaceSlug]/(app)/_components/deployments/resource-drawer/useDeploymentResourceDrawer";
import { api } from "~/trpc/react";

const StatusIcon: React.FC<{
  job?: SCHEMA.Job;
}> = ({ job }) => {
  if (job?.status === JobStatus.Pending)
    return (
      <div className="rounded-full bg-blue-400 p-1 dark:text-black">
        <IconClock strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.InProgress)
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <IconLoader2 strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Executing)
    return (
      <div className="rounded-full bg-blue-500 p-1 dark:text-black">
        <IconPlayerPlay strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Successful)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCircleCheck strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Cancelled)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconCircleX strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Failure)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconCircleX strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Skipped)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconCircleDashed strokeWidth={2} />
      </div>
    );

  if (
    job?.status === JobStatus.InvalidJobAgent ||
    job?.status === JobStatus.InvalidIntegration
  )
    return (
      <div className="rounded-full bg-orange-500 p-1 dark:text-black">
        <IconAlertCircle strokeWidth={2} />
      </div>
    );

  return null;
};

type DeploymentNodeProps = NodeProps<{
  label: string;
  deployment: SCHEMA.Deployment;
  environment: SCHEMA.Environment;
  resource: SCHEMA.Resource;
}>;

export const DeploymentNode: React.FC<DeploymentNodeProps> = ({ data }) => {
  const { deployment, environment, resource } = data;
  const { setDeploymentEnvResourceId } = useDeploymentEnvResourceDrawer();

  const resourceId = resource.id;
  const environmentId = environment.id;
  const latestDeployedVersionsQ =
    api.resource.latestDeployedVersions.byResourceAndEnvironmentId.useQuery(
      { resourceId, environmentId },
      { refetchInterval: 5_000 },
    );
  const latestDeployedVersions = latestDeployedVersionsQ.data ?? [];
  const latestDeployedVersion = latestDeployedVersions.find(
    (r) => r.releaseJobTrigger.deploymentVersion.deploymentId === deployment.id,
  );

  const isInProgress = latestDeployedVersions.some(
    (r) =>
      r.releaseJobTrigger.job.status === JobStatus.InProgress ||
      r.releaseJobTrigger.job.status === JobStatus.Executing,
  );
  const isPending = latestDeployedVersions.some(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Pending,
  );
  const isSuccess = latestDeployedVersions.every(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Successful,
  );

  const releaseJobTrigger = latestDeployedVersion?.releaseJobTrigger;

  return (
    <>
      <div
        className={cn(
          "relative flex h-[70px] w-[250px] cursor-pointer items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/30 px-4",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isSuccess && "border-green-500",
          releaseJobTrigger == null && "border-neutral-800",
        )}
        onClick={() =>
          setDeploymentEnvResourceId(deployment.id, environment.id, resource.id)
        }
      >
        <StatusIcon job={releaseJobTrigger?.job} />
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <span className="w-full truncate">{deployment.name}</span>
          {releaseJobTrigger != null && (
            <span className="w-full truncate text-sm">
              {releaseJobTrigger.deploymentVersion.name} -{" "}
              {JobStatusReadable[releaseJobTrigger.job.status]}
            </span>
          )}
          {releaseJobTrigger == null && (
            <span className="w-full truncate text-sm text-muted-foreground">
              No versions deployed
            </span>
          )}
        </div>
      </div>
      <Handle
        type="target"
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isSuccess && "border-green-500",
          releaseJobTrigger == null && "border-neutral-800",
        )}
        position={Position.Left}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "h-2 w-2 rounded-full border border-neutral-800 bg-neutral-800",
          isInProgress && "border-blue-500",
          isPending && "border-neutral-500",
          isSuccess && "border-green-500",
          releaseJobTrigger == null && "border-neutral-800",
        )}
      />
    </>
  );
};
