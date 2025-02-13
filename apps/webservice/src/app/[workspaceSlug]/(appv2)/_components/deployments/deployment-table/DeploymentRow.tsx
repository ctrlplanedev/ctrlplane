import type { RouterOutputs } from "@ctrlplane/api";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import prettyMilliseconds from "pretty-ms";

import { TableCell, TableRow } from "@ctrlplane/ui/table";

import { LazyDeploymentHistoryGraph } from "../DeploymentHistoryGraph";

type DeploymentStats =
  RouterOutputs["deployment"]["stats"]["byWorkspaceId"][number];

export const DeploymentRow: React.FC<{ deployment: DeploymentStats }> = ({
  deployment,
}) => {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const successRate = deployment.successRate ?? 0;

  return (
    <TableRow
      key={deployment.id}
      className="cursor-pointer border-b bg-transparent"
      onClick={() =>
        router.push(
          `/${workspaceSlug}/systems/${deployment.systemSlug}/deployments/${deployment.slug}`,
        )
      }
    >
      <TableCell className="flex max-w-60 flex-col gap-1 p-4 align-middle">
        <span className="truncate">{deployment.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {deployment.systemName} / {deployment.name}
        </span>
      </TableCell>

      <TableCell className="p-4 ">
        <span>{deployment.totalJobs.toLocaleString()}</span>
      </TableCell>

      <TableCell className="p-4 ">
        {deployment.associatedResources.toLocaleString()}
      </TableCell>

      <TableCell className="p-4 align-middle">
        <LazyDeploymentHistoryGraph deploymentId={deployment.id} />
      </TableCell>

      <TableCell className="p-4 ">
        {deployment.p50 != null
          ? prettyMilliseconds(Math.round(deployment.p50 * 1000), {
              unitCount: 2,
              secondsDecimalDigits: 0,
            })
          : "N/A"}
      </TableCell>
      <TableCell className="p-4 ">
        {deployment.p90 != null
          ? prettyMilliseconds(Math.round(deployment.p90 * 1000), {
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
          {deployment.lastRunAt
            ? formatDistanceToNowStrict(deployment.lastRunAt, {
                addSuffix: false,
              })
            : "No runs"}
        </div>
      </TableCell>
    </TableRow>
  );
};
