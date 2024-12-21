"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useParams } from "next/navigation";
import { useInView } from "react-intersection-observer";

import { Button } from "@ctrlplane/ui/button";

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/release-channel-drawer/useReleaseChannelDrawer";
import { api } from "~/trpc/react";
import { DeployButton } from "./DeployButton";
import { Release } from "./TableCells";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type BlockedEnv = RouterOutputs["release"]["blocked"][number];

type ReleaseEnvironmentCellProps = {
  environment: Environment;
  deployment: { slug: string; jobAgentId: string | null };
  release: { id: string; version: string; createdAt: Date };
  blockedEnv?: BlockedEnv;
};

const ReleaseEnvironmentCell: React.FC<ReleaseEnvironmentCellProps> = ({
  environment,
  deployment,
  release,
  blockedEnv,
}) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const { data: statuses, isLoading } =
    api.release.status.byEnvironmentId.useQuery(
      { releaseId: release.id, environmentId: environment.id },
      { refetchInterval: 2_000 },
    );

  const { setReleaseChannelId } = useReleaseChannelDrawer();

  if (isLoading)
    return <p className="text-xs text-muted-foreground">Loading...</p>;

  const hasResources = environment.resources.length > 0;
  const isAlreadyDeployed = statuses != null && statuses.length > 0;

  const hasJobAgent = deployment.jobAgentId != null;
  const isBlockedByReleaseChannel = blockedEnv != null;

  const showRelease = isAlreadyDeployed;
  const showDeployButton =
    !isAlreadyDeployed &&
    hasJobAgent &&
    hasResources &&
    !isBlockedByReleaseChannel;

  return (
    <>
      {showRelease && (
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
      )}

      {showDeployButton && (
        <DeployButton releaseId={release.id} environmentId={environment.id} />
      )}

      {!isAlreadyDeployed && (
        <div className="text-center text-xs text-muted-foreground/70">
          {isBlockedByReleaseChannel && (
            <>
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
            </>
          )}
          {!isBlockedByReleaseChannel && !hasJobAgent && "No job agent"}
          {!isBlockedByReleaseChannel &&
            hasJobAgent &&
            !hasResources &&
            "No resources"}
        </div>
      )}
    </>
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
