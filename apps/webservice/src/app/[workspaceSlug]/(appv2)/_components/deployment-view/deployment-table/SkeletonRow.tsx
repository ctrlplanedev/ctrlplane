import { Skeleton } from "@ctrlplane/ui/skeleton";

import { HistorySkeleton } from "./DeploymentHistoryGraph";

export const SkeletonRow: React.FC<{ index: number }> = ({ index }) => (
  <tr className="border-b">
    <td className="space-y-3 p-4 align-middle">
      <Skeleton className="h-3 w-14" style={{ opacity: 1 * (1 - index / 3) }} />
      <Skeleton className="h-3 w-20" style={{ opacity: 1 * (1 - index / 3) }} />
    </td>

    <td className="p-4 align-middle">
      <Skeleton className="h-3 w-8" style={{ opacity: 1 * (1 - index / 3) }} />
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
