import type { RouterOutputs } from "@ctrlplane/api";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import prettyMilliseconds from "pretty-ms";

import { Skeleton } from "@ctrlplane/ui/skeleton";
import { TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  ColumnOperator,
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobFilterType } from "@ctrlplane/validators/jobs";

import { LazyDeploymentHistoryGraph } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/DeploymentHistoryGraph";
import { api } from "~/trpc/react";

type DeploymentStats =
  RouterOutputs["deployment"]["stats"]["byWorkspaceId"][number];

type ResourceDeploymentRowProps = {
  stats: DeploymentStats;
  workspaceId: string;
};

const getFilter = (resourceId: string, deploymentId: string): JobCondition => {
  const resourceFilter: JobCondition = {
    type: JobFilterType.JobResource,
    operator: ColumnOperator.Equals,
    value: resourceId,
  };

  const deploymentFilter: JobCondition = {
    type: JobFilterType.Deployment,
    operator: ColumnOperator.Equals,
    value: deploymentId,
  };

  return {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [resourceFilter, deploymentFilter],
  };
};

export const ResourceDeploymentRow: React.FC<ResourceDeploymentRowProps> = ({
  stats,
  workspaceId,
}) => {
  const { workspaceSlug, resourceId } = useParams<{
    workspaceSlug: string;
    resourceId: string;
  }>();
  const router = useRouter();

  const successRate = stats.successRate ?? 0;
  const filter = getFilter(resourceId, stats.id);

  const { data, isLoading } = api.job.config.byWorkspaceId.list.useQuery({
    workspaceId,
    filter,
    limit: 1,
  });

  return (
    <TableRow
      key={stats.id}
      className="h-16 cursor-pointer border-b"
      onClick={() => {
        router.push(
          `/${workspaceSlug}/systems/${stats.systemSlug}/deployments/${stats.slug}/releases`,
        );
      }}
    >
      <TableCell>
        <div className="flex w-60 flex-col px-4">
          <span className="truncate">{stats.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {stats.systemName} / {stats.name}
          </span>
        </div>
      </TableCell>

      <TableCell className="p-4 align-middle">
        {!isLoading && (
          <span>{data?.[0]?.release.version ?? "No release"}</span>
        )}
        {isLoading && <Skeleton className="h-3 w-8" />}
      </TableCell>

      <TableCell className="p-4 align-middle">
        <LazyDeploymentHistoryGraph
          deploymentId={stats.id}
          resourceId={resourceId}
        />
      </TableCell>

      <TableCell className="p-4 ">
        {stats.p50 != null
          ? prettyMilliseconds(Math.round(stats.p50 * 1000), {
              unitCount: 2,
              secondsDecimalDigits: 0,
            })
          : "N/A"}
      </TableCell>
      <TableCell className="p-4 ">
        {stats.p90 != null
          ? prettyMilliseconds(Math.round(stats.p90 * 1000), {
              unitCount: 2,
              secondsDecimalDigits: 0,
            })
          : "N/A"}
      </TableCell>

      <TableCell className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-full rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${successRate.toFixed(0)}%` }}
            />
          </div>
          <div className="w-[75px] text-right">{successRate.toFixed(0)}%</div>
        </div>
      </TableCell>

      <TableCell className="hidden p-4 align-middle xl:table-cell">
        <div>
          {stats.lastRunAt
            ? formatDistanceToNowStrict(stats.lastRunAt, {
                addSuffix: false,
              })
            : "No runs"}
        </div>
      </TableCell>
    </TableRow>
  );
};
