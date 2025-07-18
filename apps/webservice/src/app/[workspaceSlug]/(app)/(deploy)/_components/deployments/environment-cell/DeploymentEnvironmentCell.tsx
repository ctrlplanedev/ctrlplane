"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { LazyDeploymentVersionEnvironmentCell } from "~/app/[workspaceSlug]/(app)/(deploy)/(raw)/systems/[systemSlug]/(raw)/deployments/[deploymentSlug]/(sidebar)/_components/release-cell/DeploymentVersionEnvironmentCell";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const CellSkeleton: React.FC = () => (
  <div className="flex h-full w-full items-center gap-2">
    <Skeleton className="h-6 w-6 rounded-full" />
    <div className="flex flex-col gap-2">
      <Skeleton className="h-[16px] w-20 rounded-full" />
      <Skeleton className="h-3 w-20 rounded-full" />
    </div>
  </div>
);

type DeploymentEnvironmentCellProps = {
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  system: { id: string; slug: string };
};

const DeploymentEnvironmentCell: React.FC<DeploymentEnvironmentCellProps> = ({
  environment,
  deployment,
  system,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { data: version, isLoading } =
    api.deployment.version.latestForEnvironment.useQuery({
      deploymentId: deployment.id,
      environmentId: environment.id,
    });

  const deploymentUrls = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug);

  if (isLoading) return <CellSkeleton />;

  if (version == null)
    return (
      <Link
        href={deploymentUrls.releases()}
        className="flex h-full w-full items-center justify-center p-2 text-muted-foreground"
      >
        <div className="flex h-full w-full items-center justify-center rounded-md text-sm hover:bg-accent">
          No versions
        </div>
      </Link>
    );

  return (
    <LazyDeploymentVersionEnvironmentCell
      environment={environment}
      deployment={deployment}
      deploymentVersion={version}
      system={system}
    />
  );
};

export const LazyDeploymentEnvironmentCell: React.FC<
  DeploymentEnvironmentCellProps
> = (props) => {
  const { ref, inView } = useInView();

  return (
    <div
      className="flex h-[70px] w-[220px] items-center justify-center"
      ref={ref}
    >
      {!inView && <CellSkeleton />}
      {inView && <DeploymentEnvironmentCell {...props} />}
    </div>
  );
};
