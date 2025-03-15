import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import React from "react";
import { Handle, Position } from "reactflow";

import { cn } from "@ctrlplane/ui";
import { JobStatus, JobStatusReadable } from "@ctrlplane/validators/jobs";

import { useDeploymentEnvResourceDrawer } from "~/app/[workspaceSlug]/(app)/_components/deployments/resource-drawer/useDeploymentResourceDrawer";
import { ReleaseIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ReleaseCell";
import { api } from "~/trpc/react";

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
  const isSuccess = latestActiveReleases.every(
    (r) => r.releaseJobTrigger.job.status === JobStatus.Successful,
  );

  const releaseJobTrigger = activeRelease?.releaseJobTrigger;

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
        <ReleaseIcon job={releaseJobTrigger?.job} />
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <span className="w-full truncate">{deployment.name}</span>
          {releaseJobTrigger != null && (
            <span className="w-full truncate text-sm">
              {releaseJobTrigger.release.name} -{" "}
              {JobStatusReadable[releaseJobTrigger.job.status]}
            </span>
          )}
          {releaseJobTrigger == null && (
            <span className="w-full truncate text-sm text-muted-foreground">
              No active release
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
