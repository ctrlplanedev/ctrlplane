"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
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

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/release-channel-drawer/useReleaseChannelDrawer";
import { api } from "~/trpc/react";
import { DeployButton } from "./DeployButton";
import { Release } from "./TableCells";

type Environment = RouterOutputs["environment"]["bySystemId"][number];

type ReleaseEnvironmentCellProps = {
  environment: Environment;
  deployment: SCHEMA.Deployment;
  release: { id: string; version: string; createdAt: Date };
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
    isBlockedEnvsLoading;
  if (isLoading)
    return <p className="text-xs text-muted-foreground">Loading...</p>;

  const hasResources = total > 0;
  const isAlreadyDeployed = statuses != null && statuses.length > 0;

  const hasJobAgent = deployment.jobAgentId != null;
  const isBlockedByReleaseChannel = blockedEnv != null;

  const showBlockedByReleaseChannel =
    isBlockedByReleaseChannel &&
    !statuses?.some((s) => s.job.status === JobStatus.InProgress);

  const showRelease = isAlreadyDeployed && !showBlockedByReleaseChannel;
  const showDeployButton =
    !isAlreadyDeployed &&
    hasJobAgent &&
    hasResources &&
    !isBlockedByReleaseChannel;

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

  if (showDeployButton)
    return (
      <DeployButton releaseId={release.id} environmentId={environment.id} />
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

  return (
    <div className="text-center text-xs text-muted-foreground/70">
      Release not deployed
    </div>
  );
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
