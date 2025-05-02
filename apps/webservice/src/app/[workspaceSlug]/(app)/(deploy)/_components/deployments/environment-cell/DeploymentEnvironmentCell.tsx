"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { LazyDeploymentVersionEnvironmentCell } from "../../../(raw)/systems/[systemSlug]/(raw)/deployments/[deploymentSlug]/(sidebar)/_components/release-cell/DeploymentVersionEnvironmentCell";

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
  systemSlug: string;
};

const DeploymentEnvironmentCell: React.FC<DeploymentEnvironmentCellProps> = ({
  environment,
  deployment,
  systemSlug,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { data, isLoading } = api.deployment.version.list.useQuery({
    deploymentId: deployment.id,
    limit: 1,
  });

  const deploymentUrls = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deployment.slug);

  if (isLoading) return <CellSkeleton />;

  const version = data?.items.at(0);
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
