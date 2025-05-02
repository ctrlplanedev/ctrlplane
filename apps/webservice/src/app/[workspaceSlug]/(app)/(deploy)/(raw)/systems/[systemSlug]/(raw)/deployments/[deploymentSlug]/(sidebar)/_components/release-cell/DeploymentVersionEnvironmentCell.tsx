"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconBoltOff,
  IconCubeOff,
  IconFilterX,
  IconShield,
} from "@tabler/icons-react";
import { format } from "date-fns";
import _ from "lodash";
import { useInView } from "react-intersection-observer";
import { isPresent } from "ts-is-present";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { StatusIcon } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/environment-cell/StatusIcon";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const SkeletonCell: React.FC = () => (
  <div className="flex h-full w-full items-center gap-2">
    <Skeleton className="h-6 w-6 rounded-full" />
    <div className="flex flex-col gap-2">
      <Skeleton className="h-[16px] w-20 rounded-full" />
      <Skeleton className="h-3 w-20 rounded-full" />
    </div>
  </div>
);

const ActiveJobsCell: React.FC<{
  statuses: SCHEMA.JobStatus[];
  deploymentVersion: { id: string; tag: string; createdAt: Date };
}> = ({ statuses, deploymentVersion }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(deploymentVersion.id)
    .jobs();

  return (
    <div className="flex h-full w-full items-center justify-center p-1">
      <Link
        href={versionUrl}
        className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-accent"
      >
        <StatusIcon statuses={statuses} />
        <div className="flex flex-col">
          <div className="max-w-36 truncate font-semibold">
            {deploymentVersion.tag}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(deploymentVersion.createdAt, "MMM d, hh:mm aa")}
          </div>
        </div>
      </Link>
    </div>
  );
};

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

const NoJobAgentCell: React.FC<{
  tag: string;
}> = ({ tag }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const workflowConfigUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
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

type PolicyEvaluationResult = {
  policies: { id: string; name: string }[];
  rules: {
    anyApprovals: Record<string, string[]>;
    roleApprovals: Record<string, string[]>;
    userApprovals: Record<string, string[]>;
    versionSelector: Record<string, boolean>;
  };
};

const getPoliciesBlockingByVersionSelector = (
  policyEvaluations: PolicyEvaluationResult,
) =>
  Object.entries(policyEvaluations.rules.versionSelector)
    .filter(([_, isPassing]) => !isPassing)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

const BlockedByVersionSelectorCell: React.FC<{
  policies: { id: string; name: string }[];
  deploymentVersion: { id: string; tag: string };
}> = ({ policies, deploymentVersion }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(deploymentVersion.id)
    .checks();
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex h-full w-full items-center justify-center p-1">
          <Link
            href={versionUrl}
            className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-accent"
          >
            <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
              <IconFilterX className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <div className="max-w-36 truncate font-semibold">
                {deploymentVersion.tag}
              </div>
              <div className="text-xs text-muted-foreground">
                Blocked by version selector
              </div>
            </div>
          </Link>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <IconFilterX className="h-3 w-3" strokeWidth={2} />
            Policies blocking version
          </div>
          {policies.map((p) => (
            <Link
              href={urls
                .workspace(workspaceSlug)
                .policies()
                .edit(p.id)
                .deploymentFlow()}
              key={p.id}
              className="max-w-72 truncate underline-offset-1 hover:underline"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

const getPoliciesWithApprovalRequired = (
  policyEvaluations: PolicyEvaluationResult,
) => {
  const policiesWithAnyApprovalRequired = Object.entries(
    policyEvaluations.rules.anyApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

  const policiesWithRoleApprovalRequired = Object.entries(
    policyEvaluations.rules.roleApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

  const policiesWithUserApprovalRequired = Object.entries(
    policyEvaluations.rules.userApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

  return _.uniqBy(
    [
      ...policiesWithAnyApprovalRequired,
      ...policiesWithRoleApprovalRequired,
      ...policiesWithUserApprovalRequired,
    ],
    (p) => p.id,
  );
};

const ApprovalRequiredCell: React.FC<{
  policies: { id: string; name: string }[];
  deploymentVersion: { id: string; tag: string };
}> = ({ policies, deploymentVersion }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(deploymentVersion.id)
    .checks();
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex h-full w-full items-center justify-center p-1">
          <Link
            href={versionUrl}
            className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-accent"
          >
            <div className="rounded-full bg-yellow-400 p-1 dark:text-black">
              <IconShield className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <div className="max-w-36 truncate font-semibold">
                {deploymentVersion.tag}
              </div>
              <div className="text-xs text-muted-foreground">
                Approval required
              </div>
            </div>
          </Link>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <IconShield className="h-3 w-3" strokeWidth={2} />
            Policies missing approval
          </div>
          {policies.map((p) => (
            <Link
              href={urls
                .workspace(workspaceSlug)
                .policies()
                .edit(p.id)
                .qualitySecurity()}
              key={p.id}
              className="max-w-72 truncate underline-offset-1 hover:underline"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

type DeploymentVersionEnvironmentCellProps = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  deploymentVersion: SCHEMA.DeploymentVersion;
};

const DeploymentVersionEnvironmentCell: React.FC<
  DeploymentVersionEnvironmentCellProps
> = ({ environment, deployment, deploymentVersion }) => {
  const { data: releaseTargets, isLoading: isReleaseTargetsLoading } =
    api.releaseTarget.list.useQuery({
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
    isReleaseTargetsLoading || isPolicyEvaluationsLoading || isJobsLoading;
  if (isLoading) return <SkeletonCell />;

  const hasJobs = jobs != null && jobs.length > 0;
  if (hasJobs)
    return (
      <ActiveJobsCell
        statuses={jobs.map((j) => j.status)}
        deploymentVersion={deploymentVersion}
      />
    );

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
        deploymentVersion={deploymentVersion}
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
        deploymentVersion={deploymentVersion}
      />
    );

  const hasNoJobAgent = deployment.jobAgentId == null;
  if (hasNoJobAgent) return <NoJobAgentCell tag={deploymentVersion.tag} />;

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
