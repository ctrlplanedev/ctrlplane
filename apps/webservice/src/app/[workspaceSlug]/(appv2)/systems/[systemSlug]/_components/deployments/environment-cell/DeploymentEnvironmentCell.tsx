"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertCircle,
  IconCube,
  IconProgressCheck,
} from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { ApprovalDialog } from "../../release/ApprovalDialog";
import { ReleaseDropdownMenu } from "../../release/ReleaseDropdownMenu";
import { Release } from "./ReleaseInfo";

type DeploymentEnvironmentCellProps = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  workspace: SCHEMA.Workspace;
  systemSlug: string;
};

const DeploymentEnvironmentCell: React.FC<DeploymentEnvironmentCellProps> = ({
  environment,
  deployment,
  workspace,
  systemSlug,
}) => {
  const { data: release, isLoading: isReleaseLoading } =
    api.release.latest.byDeploymentAndEnvironment.useQuery({
      deploymentId: deployment.id,
      environmentId: environment.id,
    });

  const { data: statuses, isLoading: isStatusesLoading } =
    api.release.status.byEnvironmentId.useQuery(
      { releaseId: release?.id ?? "", environmentId: environment.id },
      { refetchInterval: 2_000, enabled: release != null },
    );

  const deploy = api.release.deploy.toEnvironment.useMutation();
  const router = useRouter();

  const isLoading = isStatusesLoading || isReleaseLoading;

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

  if (release == null)
    return (
      <p className="text-xs text-muted-foreground/70">No versions released</p>
    );

  if (release.resourceCount === 0)
    return (
      <Link
        href={`/${workspace.slug}/systems/${systemSlug}/environments/${environment.id}/resources`}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 hover:bg-secondary/50"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
            <IconCube className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <div className="max-w-36 truncate font-semibold">
              <span className="whitespace-nowrap">{release.version}</span>
            </div>
            <div className="text-xs text-muted-foreground">No resources</div>
          </div>
        </div>
      </Link>
    );

  const isAlreadyDeployed = statuses != null && statuses.length > 0;

  const hasJobAgent = deployment.jobAgentId != null;

  const isPendingApproval =
    release.approval != null && release.approval.status === "pending";

  const showRelease = isAlreadyDeployed && !isPendingApproval;

  if (showRelease)
    return (
      <div className="flex w-full items-center justify-center rounded-md p-2 hover:bg-secondary/50">
        <Release
          workspaceSlug={workspace.slug}
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

  if (!hasJobAgent)
    return (
      <div className="text-center text-xs text-muted-foreground/70">
        No job agent
      </div>
    );

  if (release.approval != null && isPendingApproval)
    return (
      <ApprovalDialog
        policyId={release.approval.policyId}
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

  return (
    <div className="flex w-full items-center justify-center rounded-md p-2 hover:bg-secondary/50">
      <Button
        className="flex w-full items-center justify-between gap-2 bg-transparent hover:bg-transparent"
        onClick={() =>
          deploy
            .mutateAsync({
              environmentId: environment.id,
              releaseId: release.id,
            })
            .then(() => router.refresh())
        }
        disabled={deploy.isPending}
      >
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-blue-400 p-1 dark:text-black">
            <IconProgressCheck className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="flex flex-col items-start">
            <div className="max-w-36 truncate font-semibold text-neutral-200">
              <span className="whitespace-nowrap">{release.version}</span>
            </div>
            <div className="text-xs text-muted-foreground">Click to deploy</div>
          </div>
        </div>

        <ReleaseDropdownMenu
          release={release}
          environment={environment}
          isReleaseActive={false}
        />
      </Button>
    </div>
  );
};

export const LazyDeploymentEnvironmentCell: React.FC<
  DeploymentEnvironmentCellProps
> = (props) => {
  const { ref, inView } = useInView();

  return (
    <div className="flex w-full items-center justify-center" ref={ref}>
      {!inView && (
        <div className="flex h-full w-full items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[16px] w-20 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>
      )}
      {inView && <DeploymentEnvironmentCell {...props} />}
    </div>
  );
};
