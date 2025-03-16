"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseStatusType } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams } from "next/navigation";
import { IconAlertCircle } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { ReleaseStatus } from "@ctrlplane/validators/releases";

import { useDeploymentVersionChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/channel/drawer/useDeploymentVersionChannelDrawer";
import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/release/ApprovalDialog";
import { ReleaseDropdownMenu } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/release/ReleaseDropdownMenu";
import { api } from "~/trpc/react";
import { DeployButton } from "./DeployButton";
import { Release } from "./TableCells";

type Release = {
  id: string;
  version: string;
  name: string;
  createdAt: Date;
  status: ReleaseStatusType;
  deploymentId: string;
};

type ReleaseEnvironmentCellProps = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  release: Release;
};

const useGetResourceCount = (
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);

  const filter: ResourceCondition | undefined =
    environment.resourceFilter != null
      ? {
          type: FilterType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [
            environment.resourceFilter,
            deployment.resourceFilter,
          ].filter(isPresent),
        }
      : undefined;

  const { data: resources, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace?.id ?? "", filter, limit: 0 },
      { enabled: workspace != null && filter != null },
    );

  return {
    resourceCount: resources?.total ?? 0,
    isResourceCountLoading: isResourcesLoading || isWorkspaceLoading,
  };
};

const ReleaseEnvironmentCell: React.FC<ReleaseEnvironmentCellProps> = ({
  environment,
  deployment,
  release,
}) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const { resourceCount, isResourceCountLoading } = useGetResourceCount(
    environment,
    deployment,
  );

  const { data: blockedEnvsResult, isLoading: isBlockedEnvsLoading } =
    api.deployment.version.blocked.useQuery([release.id]);

  const { data: approval, isLoading: isApprovalLoading } =
    api.environment.policy.approval.statusByReleasePolicyId.useQuery({
      releaseId: release.id,
      policyId: environment.policyId,
    });

  const blockedEnv = blockedEnvsResult?.find(
    (b) => b.environmentId === environment.id,
  );

  const { data: statuses, isLoading: isStatusesLoading } =
    api.deployment.version.status.byEnvironmentId.useQuery(
      { releaseId: release.id, environmentId: environment.id },
      { refetchInterval: 2_000 },
    );

  const { setDeploymentVersionChannelId } = useDeploymentVersionChannelDrawer();

  const isLoading =
    isStatusesLoading ||
    isBlockedEnvsLoading ||
    isApprovalLoading ||
    isResourceCountLoading;

  if (isLoading)
    return (
      <div className="flex h-full w-full items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[16px] w-20 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
      </div>
    );

  if (resourceCount === 0)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        No resources
      </div>
    );

  const isAlreadyDeployed = statuses != null && statuses.length > 0;

  const hasJobAgent = deployment.jobAgentId != null;
  const isBlockedByDeploymentVersionChannel = blockedEnv != null;

  const isPendingApproval = approval?.status === "pending";

  const showBlockedByDeploymentVersionChannel =
    isBlockedByDeploymentVersionChannel &&
    !statuses?.some((s) => s.job.status === JobStatus.InProgress);

  const showRelease =
    isAlreadyDeployed &&
    !showBlockedByDeploymentVersionChannel &&
    !isPendingApproval;

  if (showRelease)
    return (
      <div className="flex w-full items-center justify-center rounded-md p-2 hover:bg-secondary/50">
        <Release
          workspaceSlug={workspaceSlug}
          systemSlug={systemSlug}
          deploymentSlug={deployment.slug}
          releaseId={release.id}
          version={release.version}
          environment={environment}
          name={release.version}
          deployedAt={release.createdAt}
          statuses={statuses.map((s) => s.job.status)}
        />
      </div>
    );

  if (release.status === ReleaseStatus.Building)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        Release is building
      </div>
    );

  if (release.status === ReleaseStatus.Failed)
    return (
      <div className="text-center text-xs text-red-500">Release failed</div>
    );

  if (showBlockedByDeploymentVersionChannel)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        Blocked by{" "}
        <Button
          variant="link"
          size="sm"
          onClick={() =>
            setDeploymentVersionChannelId(blockedEnv.releaseChannelId ?? null)
          }
          className="px-0 text-muted-foreground/70"
        >
          release channel
        </Button>
      </div>
    );

  if (!hasJobAgent)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        No job agent
      </div>
    );

  if (isPendingApproval)
    return (
      <ApprovalDialog
        policyId={approval.policyId}
        release={release}
        environmentId={environment.id}
      >
        <div className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 hover:bg-secondary/50">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-yellow-400 p-1 dark:text-black">
              <IconAlertCircle className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <div className="max-w-36 truncate font-semibold">
                <span className="whitespace-nowrap">{release.version}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Approval required
              </div>
            </div>
          </div>

          <ReleaseDropdownMenu
            release={release}
            environment={environment}
            isReleaseActive={false}
          />
        </div>
      </ApprovalDialog>
    );

  return <DeployButton releaseId={release.id} environmentId={environment.id} />;
};

export const LazyReleaseEnvironmentCell: React.FC<
  ReleaseEnvironmentCellProps
> = (props) => {
  const { ref, inView } = useInView();

  return (
    <div className="flex w-full items-center justify-center" ref={ref}>
      {!inView && <p className="text-xs text-muted-foreground">Loading...</p>}
      {inView && <ReleaseEnvironmentCell {...props} />}
    </div>
  );
};
