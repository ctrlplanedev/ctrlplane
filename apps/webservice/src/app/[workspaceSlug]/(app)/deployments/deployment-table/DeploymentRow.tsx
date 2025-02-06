import type { RouterOutputs } from "@ctrlplane/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import prettyMilliseconds from "pretty-ms";

import { LazyDeploymentHistoryGraph } from "./DeploymentHistoryGraph";

type DeploymentStats =
  RouterOutputs["deployment"]["stats"]["byWorkspaceId"][number];

export const DeploymentRow: React.FC<{ deployment: DeploymentStats }> = ({
  deployment,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  return (
    <tr key={deployment.id} className="border-b">
      <td className="p-4 align-middle">
        <Link
          href={`/${workspaceSlug}/systems/${deployment.systemSlug}/deployments/${deployment.slug}/releases`}
          target="_blank"
        >
          <div className="flex items-center gap-2">{deployment.name}</div>
          <div className="text-xs text-muted-foreground">
            {deployment.systemName} / {deployment.name}
          </div>
        </Link>
      </td>

      <td className="p-4 ">{deployment.totalJobs.toLocaleString()}</td>

      <td className="p-4 ">
        {deployment.associatedResources.toLocaleString()}
      </td>

      <td className="p-4 align-middle">
        <LazyDeploymentHistoryGraph deploymentId={deployment.id} />
      </td>

      <td className="p-4 ">
        {deployment.p50 != null
          ? prettyMilliseconds(Math.round(deployment.p50) * 1000)
          : "N/A"}
      </td>
      <td className="p-4 ">
        {deployment.p90 != null
          ? prettyMilliseconds(Math.round(deployment.p90) * 1000)
          : "N/A"}
      </td>

      <td className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-full rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${deployment.successRate.toFixed(0)}%` }}
            />
          </div>
          <div className="w-[75px] text-right">
            {deployment.successRate.toFixed(0)}%
          </div>
        </div>
      </td>

      <td className="hidden p-4 align-middle xl:table-cell">
        <div>
          {deployment.lastRunAt
            ? formatDistanceToNowStrict(deployment.lastRunAt, {
                addSuffix: false,
              })
            : "No runs"}
        </div>
      </td>
    </tr>
  );
};
