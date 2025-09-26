"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";
import { IconBoltOff, IconCubeOff, IconHourglass } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { urls } from "~/app/urls";
import { useActiveJobs } from "./_hooks/useActiveJobs";
import { useHasReleaseTargets } from "./_hooks/useHasReleaseTargets";
import { usePolicyEvaluations } from "./_hooks/useIsBlockedByPolicyVersionSelector";
import { useBlockingRelease } from "./_hooks/useIsWaitingOnAnotherRelease";
import { ActiveJobsCell } from "./ActiveJobsCell";
import { ApprovalRequiredCell } from "./ApprovalRequiredCell";
import { BlockedByVersionSelectorCell } from "./BlockedByVersionSelectorCell";
import { Cell } from "./Cell";
import {
  DeploymentVersionEnvironmentProvider,
  useDeploymentVersionEnvironmentContext,
} from "./DeploymentVersionEnvironmentContext";
import { VersionStatusCell } from "./VersionStatusCell";

const SkeletonCell: React.FC = () => (
  <div className="flex h-full w-full items-center gap-2">
    <Skeleton className="h-6 w-6 rounded-full" />
    <div className="flex flex-col gap-2">
      <Skeleton className="h-[16px] w-20 rounded-full" />
      <Skeleton className="h-3 w-20 rounded-full" />
    </div>
  </div>
);

const NoReleaseTargetsCell: React.FC = () => {
  const { deploymentVersion } = useDeploymentVersionEnvironmentContext();
  const { tag } = deploymentVersion;

  return (
    <div className="flex h-full w-full items-center justify-center p-1">
      <div className="flex w-full items-center gap-2 rounded-md p-2">
        <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
          <IconCubeOff className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <div className="max-w-36 truncate font-semibold">{tag}</div>
          <div className="text-xs text-muted-foreground">No resources</div>
        </div>
      </div>
    </div>
  );
};

const BlockedByActiveJobsCell: React.FC<{ versionId: string }> = ({
  versionId,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { deployment, system } = useDeploymentVersionEnvironmentContext();

  const deploymentUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .release(versionId)
    .jobs();

  return (
    <Cell
      Icon={
        <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
          <IconHourglass className="h-4 w-4" strokeWidth={2} />
        </div>
      }
      url={deploymentUrl}
      label="Waiting on another release"
    />
  );
};

const NoJobAgentCell: React.FC = () => {
  const { deployment, system } = useDeploymentVersionEnvironmentContext();

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const workflowConfigUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .workflow();

  return (
    <Cell
      Icon={
        <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
          <IconBoltOff className="h-4 w-4" strokeWidth={2} />
        </div>
      }
      url={workflowConfigUrl}
      label="No job agent"
    />
  );
};

const DeploymentVersionEnvironmentCell: React.FC = () => {
  const { deployment, deploymentVersion } =
    useDeploymentVersionEnvironmentContext();

  const { hasNoReleaseTargets, isReleaseTargetsLoading } =
    useHasReleaseTargets();
  const { blockingRelease, isBlockingReleaseLoading } = useBlockingRelease();

  const { isPolicyEvaluationsLoading, versionSelector, approvalRequired } =
    usePolicyEvaluations();

  const { statuses, isStatusesLoading } = useActiveJobs();

  const isLoading =
    isReleaseTargetsLoading ||
    isPolicyEvaluationsLoading ||
    isStatusesLoading ||
    isBlockingReleaseLoading;

  if (isLoading) return <SkeletonCell />;

  if (statuses.length > 0) return <ActiveJobsCell statuses={statuses} />;

  if (versionSelector.isBlocking)
    return <BlockedByVersionSelectorCell policies={versionSelector.policies} />;

  const isNotReady = deploymentVersion.status !== "ready";
  if (isNotReady) return <VersionStatusCell />;

  if (hasNoReleaseTargets) return <NoReleaseTargetsCell />;

  if (approvalRequired.isRequired)
    return <ApprovalRequiredCell policies={approvalRequired.policies} />;

  if (blockingRelease != null)
    return <BlockedByActiveJobsCell versionId={deploymentVersion.id} />;

  const hasNoJobAgent = deployment.jobAgentId == null;
  if (hasNoJobAgent) return <NoJobAgentCell />;

  return <VersionStatusCell />;
};

type LazyDeploymentVersionEnvironmentCellProps = {
  system: { id: string; slug: string };
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  deploymentVersion: SCHEMA.DeploymentVersion;
};

export const LazyDeploymentVersionEnvironmentCell: React.FC<
  LazyDeploymentVersionEnvironmentCellProps
> = (props) => {
  const { ref, inView } = useInView();

  return (
    <DeploymentVersionEnvironmentProvider {...props}>
      <div className="flex h-full w-full items-center justify-center" ref={ref}>
        {!inView && <SkeletonCell />}
        {inView && <DeploymentVersionEnvironmentCell />}
      </div>
    </DeploymentVersionEnvironmentProvider>
  );
};
