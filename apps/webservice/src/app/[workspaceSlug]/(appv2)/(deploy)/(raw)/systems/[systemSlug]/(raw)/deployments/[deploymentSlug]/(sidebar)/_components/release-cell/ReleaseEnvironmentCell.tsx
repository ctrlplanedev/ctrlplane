"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseStatusType } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams } from "next/navigation";
import { useInView } from "react-intersection-observer";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { ReleaseStatus } from "@ctrlplane/validators/releases";

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/release-channel-drawer/useReleaseChannelDrawer";
import { ApprovalDialog } from "~/app/[workspaceSlug]/(appv2)/(deploy)/_components/release/ApprovalDialog";
import { api } from "~/trpc/react";
import { DeployButton } from "./DeployButton";
import { Release } from "./TableCells";

type Release = {
  id: string;
  version: string;
  createdAt: Date;
  status: ReleaseStatusType;
  deploymentId: string;
};

type ReleaseEnvironmentCellProps = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  release: Release;
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

  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);

  const filter: ResourceCondition | undefined =
    environment.resourceFilter != null || deployment.resourceFilter != null
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

  const { data: blockedEnvsResult, isLoading: isBlockedEnvsLoading } =
    api.release.blocked.useQuery([release.id]);

  const { data: approval, isLoading: isApprovalLoading } =
    api.environment.policy.approval.statusByReleasePolicyId.useQuery({
      releaseId: release.id,
      policyId: environment.policyId,
    });

  const blockedEnv = blockedEnvsResult?.find(
    (b) => b.environmentId === environment.id,
  );

  const { data: statuses, isLoading: isStatusesLoading } =
    api.release.status.byEnvironmentId.useQuery(
      { releaseId: release.id, environmentId: environment.id },
      { refetchInterval: 2_000 },
    );

  const { setReleaseChannelId } = useReleaseChannelDrawer();

  const isLoading =
    isStatusesLoading ||
    isBlockedEnvsLoading ||
    isApprovalLoading ||
    isWorkspaceLoading ||
    isResourcesLoading;

  if (isLoading)
    return <p className="text-xs text-muted-foreground">Loading...</p>;

  if ((resources?.total ?? 0) === 0)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        No resources
      </div>
    );

  const isAlreadyDeployed = statuses != null && statuses.length > 0;

  const hasJobAgent = deployment.jobAgentId != null;
  const isBlockedByReleaseChannel = blockedEnv != null;

  const isPendingApproval = approval?.status === "pending";

  const showBlockedByReleaseChannel =
    isBlockedByReleaseChannel &&
    !statuses?.some((s) => s.job.status === JobStatus.InProgress);

  const showRelease =
    isAlreadyDeployed && !showBlockedByReleaseChannel && !isPendingApproval;

  if (showRelease)
    return (
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

  if (showBlockedByReleaseChannel)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        Blocked by{" "}
        <Button
          variant="link"
          size="sm"
          onClick={() =>
            setReleaseChannelId(blockedEnv.releaseChannelId ?? null)
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
        <Button
          className="w-full border-dashed border-neutral-700/60 bg-transparent text-center text-neutral-700 hover:border-blue-400 hover:bg-transparent hover:text-blue-400"
          variant="outline"
          size="sm"
        >
          Pending approval
        </Button>
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
