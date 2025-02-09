import { Skeleton } from "@ctrlplane/ui/skeleton";

import { HistorySkeleton } from "~/app/[workspaceSlug]/(appv2)/_components/deployments/DeploymentHistoryGraph";

export const ResourceDeploymentRowSkeleton: React.FC<{ index: number }> = ({
  index,
}) => (
  <tr className="h-16 border-b">
    <td>
      {/* hardcode so that the skeleton doesn't cause visual shift of the table header */}
      <div className="w-[254px] space-y-3 px-4 align-middle">
        <Skeleton
          className="h-3 w-14"
          style={{ opacity: 1 * (1 - index / 3) }}
        />
        <Skeleton
          className="h-3 w-20"
          style={{ opacity: 1 * (1 - index / 3) }}
        />
      </div>
    </td>

    <td className="p-4 align-middle">
      <Skeleton className="h-3 w-8" style={{ opacity: 1 * (1 - index / 3) }} />
    </td>

    <td className="p-4 align-middle">
      <HistorySkeleton />
    </td>

    <td className="p-4 align-middle">
      <Skeleton className="h-3 w-8" style={{ opacity: 1 * (1 - index / 3) }} />
    </td>

    <td className="p-4 align-middle">
      <Skeleton className="h-3 w-8" style={{ opacity: 1 * (1 - index / 3) }} />
    </td>

    <td className="p-4 align-middle">
      <Skeleton className="h-3 w-14" style={{ opacity: 1 * (1 - index / 3) }} />
    </td>

    <td className="hidden p-4 align-middle xl:table-cell">
      <Skeleton className="h-3 w-14" style={{ opacity: 1 * (1 - index / 3) }} />
    </td>
  </tr>
);
