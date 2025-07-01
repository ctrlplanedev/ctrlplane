"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";
import { IconBoltOff, IconClock, IconCubeOff } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { ActiveJobsCell } from "./ActiveJobsCell";
import {
  ApprovalRequiredCell,
  getPoliciesWithApprovalRequired,
} from "./ApprovalRequiredCell";
import {
  BlockedByVersionSelectorCell,
  getPoliciesBlockingByVersionSelector,
} from "./BlockedByVersionSelectorCell";
import { Cell } from "./Cell";
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

const NoReleaseTargetsCell: React.FC<{
  tag: string;
}> = ({ tag }) => (
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

const BlockedByActiveJobsCell: React.FC<{
  deploymentVersion: { id: string; tag: string };
  deployment: { id: string; name: string; slug: string };
  system: { slug: string };
  isVersionPinned?: boolean;
}> = ({ deploymentVersion, deployment, system, isVersionPinned }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const deploymentUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .releases();

  return (
    <Cell
      Icon={
        <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
          <IconClock className="h-4 w-4" strokeWidth={2} />
        </div>
      }
      url={deploymentUrl}
      tag={deploymentVersion.tag}
      label="Waiting on another release"
      isVersionPinned={isVersionPinned}
    />
  );
};

const NoJobAgentCell: React.FC<{
  tag: string;
  system: { slug: string };
  deployment: { slug: string };
}> = ({ tag, system, deployment }) => {
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
      tag={tag}
      label="No job agent"
    />
  );
};

type DeploymentVersionEnvironmentCellProps = {
  system: { id: string; slug: string };
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  deploymentVersion: SCHEMA.DeploymentVersion;
};

const useIsPinned = (environmentId: string, versionId: string) => {
  const { data, isLoading } =
    api.environment.versionPinning.pinnedVersions.useQuery({
      environmentId,
    });

  const isPinned = data != null && data.length === 1 && data[0] === versionId;

  return { isPinned, isPinnedVersionsLoading: isLoading };
};

const DeploymentVersionEnvironmentCell: React.FC<
  DeploymentVersionEnvironmentCellProps
> = (props) => {
  const { environment, deployment, deploymentVersion } = props;
  const { data: releaseTargetsResult, isLoading: isReleaseTargetsLoading } =
    api.releaseTarget.list.useQuery({
      environmentId: environment.id,
      deploymentId: deployment.id,
      limit: 0,
    });
  const numReleaseTargets = releaseTargetsResult?.total ?? 0;

  const {
    data: targetsWithActiveJobs,
    isLoading: isTargetsWithActiveJobsLoading,
  } = api.releaseTarget.activeJobs.useQuery({
    environmentId: environment.id,
    deploymentId: deployment.id,
  });

  const { data: policyEvaluations, isLoading: isPolicyEvaluationsLoading } =
    api.policy.evaluate.useQuery({
      environmentId: environment.id,
      versionId: deploymentVersion.id,
    });

  const { data: jobs, isLoading: isJobsLoading } =
    api.deployment.version.job.byEnvironment.useQuery({
      versionId: deploymentVersion.id,
      environmentId: environment.id,
    });

  const { isPinned, isPinnedVersionsLoading } = useIsPinned(
    environment.id,
    deploymentVersion.id,
  );

  const isLoading =
    isReleaseTargetsLoading ||
    isPolicyEvaluationsLoading ||
    isJobsLoading ||
    isTargetsWithActiveJobsLoading ||
    isPinnedVersionsLoading;
  if (isLoading) return <SkeletonCell />;

  const hasJobs = jobs != null && jobs.length > 0;
  if (hasJobs)
    return (
      <ActiveJobsCell
        isVersionPinned={isPinned}
        statuses={jobs.map((j) => j.status)}
        {...props}
      />
    );

  const policiesWithBlockingVersionSelector =
    policyEvaluations != null
      ? getPoliciesBlockingByVersionSelector(policyEvaluations)
      : [];

  const isBlockedByVersionSelector =
    policiesWithBlockingVersionSelector.length > 0;
  if (isBlockedByVersionSelector)
    return (
      <BlockedByVersionSelectorCell
        policies={policiesWithBlockingVersionSelector}
        {...props}
      />
    );

  const isNotReady = deploymentVersion.status !== "ready";
  if (isNotReady)
    return <VersionStatusCell isVersionPinned={isPinned} {...props} />;

  const hasNoReleaseTargets = numReleaseTargets === 0;
  if (hasNoReleaseTargets)
    return <NoReleaseTargetsCell tag={deploymentVersion.tag} />;

  const policiesWithApprovalRequired =
    policyEvaluations != null
      ? getPoliciesWithApprovalRequired(policyEvaluations)
      : [];

  const isApprovalRequired = policiesWithApprovalRequired.length > 0;
  if (isApprovalRequired)
    return (
      <ApprovalRequiredCell
        policies={policiesWithApprovalRequired}
        {...props}
      />
    );

  const allActiveJobs = (targetsWithActiveJobs ?? []).flatMap((t) => t.jobs);
  const isWaitingOnActiveJobs = allActiveJobs.some(
    ({ versionId }) => versionId !== deploymentVersion.id,
  );
  if (isWaitingOnActiveJobs)
    return <BlockedByActiveJobsCell isVersionPinned={isPinned} {...props} />;

  const hasNoJobAgent = deployment.jobAgentId == null;
  if (hasNoJobAgent)
    return <NoJobAgentCell tag={deploymentVersion.tag} {...props} />;

  return <VersionStatusCell isVersionPinned={isPinned} {...props} />;
};

export const LazyDeploymentVersionEnvironmentCell: React.FC<
  DeploymentVersionEnvironmentCellProps
> = (props) => {
  const { ref, inView } = useInView();

  return (
    <div className="flex h-full w-full items-center justify-center" ref={ref}>
      {!inView && <p className="text-xs text-muted-foreground">Loading...</p>}
      {inView && <DeploymentVersionEnvironmentCell {...props} />}
    </div>
  );
};
