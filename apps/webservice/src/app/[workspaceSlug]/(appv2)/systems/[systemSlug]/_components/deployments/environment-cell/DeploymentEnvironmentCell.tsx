"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconAlertCircle,
  IconCube,
  IconProgressCheck,
} from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { ApprovalDialog } from "../../release/ApprovalDialog";
import { ReleaseDropdownMenu } from "../../release/ReleaseDropdownMenu";
import { Release } from "./ReleaseInfo";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type Deployment = RouterOutputs["deployment"]["bySystemId"][number];

type DeploymentEnvironmentCellProps = {
  environment: Environment;
  deployment: Deployment;
  workspace: { id: string; slug: string };
};

const DeploymentEnvironmentCell: React.FC<DeploymentEnvironmentCellProps> = ({
  environment,
  deployment,
  workspace,
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
    return <p className="text-xs text-muted-foreground/70">Loading...</p>;

  if (release == null)
    return (
      <p className="text-xs text-muted-foreground/70">No versions released</p>
    );

  if (release.resourceCount === 0)
    return (
      <Link
        href={`/${workspace.slug}/systems/${deployment.system.slug}/environments/${environment.id}/resources`}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 hover:bg-secondary/50"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
            <IconCube className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <div className="font-semibold">{release.version}</div>
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
          systemSlug={deployment.system.slug}
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
              <div className="font-semibold">{release.version}</div>
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
            <div className="font-semibold text-neutral-200">
              {release.version}
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
      {!inView && <p className="text-xs text-muted-foreground">Loading...</p>}
      {inView && <DeploymentEnvironmentCell {...props} />}
    </div>
  );
};
