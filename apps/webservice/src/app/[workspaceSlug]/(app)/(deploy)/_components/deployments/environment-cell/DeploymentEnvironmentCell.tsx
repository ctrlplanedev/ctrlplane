"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { StatusIcon } from "./StatusIcon";

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
  environmentId: string;
  deployment: { id: string; slug: string };
  systemSlug: string;
};

const DeploymentEnvironmentCell: React.FC<DeploymentEnvironmentCellProps> = ({
  environmentId,
  deployment,
  systemSlug,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { data, isLoading } = api.system.table.cell.useQuery({
    environmentId,
    deploymentId: deployment.id,
  });

  const deploymentUrls = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deployment.slug);

  if (isLoading) return <CellSkeleton />;

  if (data == null)
    return (
      <Link
        href={deploymentUrls.releases()}
        className="flex h-full w-full items-center justify-center p-2 text-muted-foreground"
      >
        <div className="flex h-full w-full items-center justify-center hover:bg-accent">
          No jobs
        </div>
      </Link>
    );

  const versionUrl = deploymentUrls.release(data.versionId).baseUrl();

  return (
    <div className="flex h-full w-full items-center justify-center p-1">
      <Link
        href={versionUrl}
        className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-accent"
      >
        <StatusIcon statuses={data.statuses} />
        <div className="flex flex-col">
          <div className="max-w-36 truncate font-semibold">
            {data.versionTag}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(data.versionCreatedAt, "MMM d, hh:mm aa")}
          </div>
        </div>
      </Link>
    </div>
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
