import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import prettyMilliseconds from "pretty-ms";

import { cn } from "@ctrlplane/ui";
import { TableCell, TableRow } from "@ctrlplane/ui/table";

import { LazyDeploymentHistoryGraph } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/DeploymentHistoryGraph";

type DeploymentStats =
  RouterOutputs["deployment"]["stats"]["byWorkspaceId"][number] & {
    latestTrigger?: RouterOutputs["job"]["config"]["byWorkspaceId"]["list"][number];
    resource: SCHEMA.Resource;
  };

type ResourceDeploymentRowProps = { stats: DeploymentStats };

export const ResourceDeploymentRow: React.FC<ResourceDeploymentRowProps> = ({
  stats,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();

  const successRate = stats.successRate ?? 0;

  return (
    <TableRow
      key={stats.id}
      className={cn(
        "h-16 border-b",
        stats.latestTrigger == null ? "hover:bg-transparent" : "cursor-pointer",
      )}
      onClick={() => {
        router.push(
          `/${workspaceSlug}/systems/${stats.systemSlug}/deployments/${stats.id}/releases`,
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

      <TableCell className="p-4">
        <span>{stats.latestTrigger?.release.version ?? "No release"}</span>
      </TableCell>

      <TableCell className="p-4 align-middle">
        <LazyDeploymentHistoryGraph
          deploymentId={stats.id}
          resourceId={stats.resource.id}
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
