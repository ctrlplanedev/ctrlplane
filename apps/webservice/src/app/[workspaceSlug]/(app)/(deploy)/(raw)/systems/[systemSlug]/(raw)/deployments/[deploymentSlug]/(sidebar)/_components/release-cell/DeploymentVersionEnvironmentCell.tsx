"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { DeploymentVersionStatusType } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams } from "next/navigation";
import { IconAlertCircle } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { useDeploymentVersionChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/channel/drawer/useDeploymentVersionChannelDrawer";
import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";
import { DeploymentVersionDropdownMenu } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { api } from "~/trpc/react";
import { DeployButton } from "./DeployButton";
import { DeploymentVersion as DepVersion } from "./TableCells";

type DepVersion = {
  id: string;
  tag: string;
  name: string;
  createdAt: Date;
  status: DeploymentVersionStatusType;
  deploymentId: string;
};

type DeploymentVersionEnvironmentCellProps = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  deploymentVersion: DepVersion;
};

const useGetResourceCount = (
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);

  const condition: ResourceCondition | undefined =
    environment.resourceSelector != null
      ? {
          type: ConditionType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [
            environment.resourceSelector,
            deployment.resourceSelector,
          ].filter(isPresent),
        }
      : undefined;

  const { data: resources, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace?.id ?? "", filter: condition, limit: 0 },
      { enabled: workspace != null && condition != null },
    );

  return {
    resourceCount: resources?.total ?? 0,
    isResourceCountLoading: isResourcesLoading || isWorkspaceLoading,
  };
};

const DeploymentVersionEnvironmentCell: React.FC<
  DeploymentVersionEnvironmentCellProps
> = ({ environment, deployment, deploymentVersion }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const { resourceCount, isResourceCountLoading } = useGetResourceCount(
    environment,
    deployment,
  );

  const { data: blockedEnvsResult, isLoading: isBlockedEnvsLoading } =
    api.deployment.version.blocked.useQuery([deploymentVersion.id]);

  const { data: approval, isLoading: isApprovalLoading } =
    api.environment.policy.approval.statusByVersionPolicyId.useQuery({
      versionId: deploymentVersion.id,
      policyId: environment.policyId,
    });

  const blockedEnv = blockedEnvsResult?.find(
    (b) => b.environmentId === environment.id,
  );

  const { data: statuses, isLoading: isStatusesLoading } =
    api.deployment.version.status.byEnvironmentId.useQuery(
      { versionId: deploymentVersion.id, environmentId: environment.id },
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

  const showVersion =
    isAlreadyDeployed &&
    !showBlockedByDeploymentVersionChannel &&
    !isPendingApproval;

  if (showVersion)
    return (
      <div className="flex w-full items-center justify-center rounded-md p-2 hover:bg-secondary/50">
        <DepVersion
          workspaceSlug={workspaceSlug}
          systemSlug={systemSlug}
          deploymentSlug={deployment.slug}
          versionId={deploymentVersion.id}
          tag={deploymentVersion.tag}
          environment={environment}
          name={deploymentVersion.name}
          deployedAt={deploymentVersion.createdAt}
          statuses={statuses.map((s) => s.job.status)}
        />
      </div>
    );

  if (deploymentVersion.status === DeploymentVersionStatus.Building)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        Version is building
      </div>
    );

  if (deploymentVersion.status === DeploymentVersionStatus.Failed)
    return (
      <div className="text-center text-xs text-red-500">
        Version build failed
      </div>
    );

  if (showBlockedByDeploymentVersionChannel)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        Blocked by{" "}
        <Button
          variant="link"
          size="sm"
          onClick={() =>
            setDeploymentVersionChannelId(
              blockedEnv.deploymentVersionChannelId ?? null,
            )
          }
          className="px-0 text-muted-foreground/70"
        >
          channel
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
        deploymentVersion={deploymentVersion}
        environmentId={environment.id}
      >
        <div className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 hover:bg-secondary/50">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-yellow-400 p-1 dark:text-black">
              <IconAlertCircle className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <div className="max-w-36 truncate font-semibold">
                <span className="whitespace-nowrap">
                  {deploymentVersion.tag}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Approval required
              </div>
            </div>
          </div>

          <DeploymentVersionDropdownMenu
            deployment={deployment}
            environment={environment}
            isVersionBeingDeployed={false}
          />
        </div>
      </ApprovalDialog>
    );

  return (
    <DeployButton deploymentId={deployment.id} environmentId={environment.id} />
  );
};

export const LazyDeploymentVersionEnvironmentCell: React.FC<
  DeploymentVersionEnvironmentCellProps
> = (props) => {
  const { ref, inView } = useInView();

  return (
    <div className="flex w-full items-center justify-center" ref={ref}>
      {!inView && <p className="text-xs text-muted-foreground">Loading...</p>}
      {inView && <DeploymentVersionEnvironmentCell {...props} />}
    </div>
  );
};
