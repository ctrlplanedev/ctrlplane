"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
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
}> = ({ deploymentVersion, deployment, system }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const deploymentUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .releases();

  return (
    <div className="flex h-full w-full items-center justify-center p-1">
      <Link
        href={deploymentUrl}
        className="flex w-full items-center gap-2 rounded-md p-2"
      >
        <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
          <IconClock className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <div className="max-w-36 truncate font-semibold">
            {deploymentVersion.tag}
          </div>
          <div className="text-xs text-muted-foreground">
            Waiting on another release
          </div>
        </div>
      </Link>
    </div>
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
    <div className="flex h-full w-full items-center justify-center p-1">
      <Link
        href={workflowConfigUrl}
        className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-accent"
      >
        <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
          <IconBoltOff className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <div className="max-w-36 truncate font-semibold">{tag}</div>
          <div className="text-xs text-muted-foreground">No job agent</div>
        </div>
      </Link>
    </div>
  );
};

type DeploymentVersionEnvironmentCellProps = {
  system: { slug: string };
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  deploymentVersion: SCHEMA.DeploymentVersion;
};

const DeploymentVersionEnvironmentCell: React.FC<
  DeploymentVersionEnvironmentCellProps
> = (props) => {
  const { environment, deployment, deploymentVersion } = props;
  const { data: releaseTargets, isLoading: isReleaseTargetsLoading } =
    api.releaseTarget.list.useQuery({
      environmentId: environment.id,
      deploymentId: deployment.id,
    });

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

  const isLoading =
    isReleaseTargetsLoading ||
    isPolicyEvaluationsLoading ||
    isJobsLoading ||
    isTargetsWithActiveJobsLoading;
  if (isLoading) return <SkeletonCell />;

  const hasJobs = jobs != null && jobs.length > 0;
  if (hasJobs)
    return <ActiveJobsCell statuses={jobs.map((j) => j.status)} {...props} />;

  const hasNoReleaseTargets =
    releaseTargets == null || releaseTargets.length === 0;
  if (hasNoReleaseTargets)
    return <NoReleaseTargetsCell tag={deploymentVersion.tag} />;

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
  if (isWaitingOnActiveJobs) return <BlockedByActiveJobsCell {...props} />;

  const hasNoJobAgent = deployment.jobAgentId == null;
  if (hasNoJobAgent)
    return <NoJobAgentCell tag={deploymentVersion.tag} {...props} />;

  return <NoReleaseTargetsCell tag={deploymentVersion.tag} />;
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
