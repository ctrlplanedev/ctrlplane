"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseStatusType } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams } from "next/navigation";
import _ from "lodash";
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
import { api } from "~/trpc/react";
import { ApprovalDialog } from "./[deploymentSlug]/releases/[versionId]/ApprovalCheck";
import { DeployButton } from "./DeployButton";
import { Release } from "./TableCells";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type Release = {
  id: string;
  version: string;
  createdAt: Date;
  status: ReleaseStatusType;
};

type ReleaseEnvironmentCellProps = {
  environment: Environment;
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

  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);
  const workspaceId = workspace?.id ?? "";

  const { data: statuses, isLoading: isStatusesLoading } =
    api.release.status.byEnvironmentId.useQuery(
      { releaseId: release.id, environmentId: environment.id },
      { refetchInterval: 2_000 },
    );

  const { resourceFilter: envResourceFilter } = environment;
  const { resourceFilter: deploymentResourceFilter } = deployment;

  const resourceFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [envResourceFilter, deploymentResourceFilter].filter(isPresent),
  };

  const { data: resourcesResult, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId, filter: resourceFilter, limit: 0 },
      { enabled: workspaceId !== "" && envResourceFilter != null },
    );

  const total = resourcesResult?.total ?? 0;

  const { setReleaseChannelId } = useReleaseChannelDrawer();

  const isLoading =
    isWorkspaceLoading ||
    isStatusesLoading ||
    isResourcesLoading ||
    isBlockedEnvsLoading ||
    isApprovalLoading;

  if (isLoading)
    return <p className="text-xs text-muted-foreground">Loading...</p>;

  const hasResources = total > 0;
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

  if (!hasResources)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        No resources
      </div>
    );

  if (isPendingApproval)
    return (
      <ApprovalDialog policyId={approval.policyId} release={release}>
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
