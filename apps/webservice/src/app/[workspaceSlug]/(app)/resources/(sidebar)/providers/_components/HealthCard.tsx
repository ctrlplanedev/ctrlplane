import { IconHeartRateMonitor } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

export const HealthCard: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const { data } =
    api.resource.provider.page.health.byWorkspaceId.useQuery(workspaceId);

  const { data: providerCount, isLoading: isProviderCountLoading } =
    api.resource.provider.page.list.byWorkspaceId.count.useQuery({
      workspaceId,
    });

  const { latestSync } = data ?? { total: 0, latestSync: null };

  const syncedTimeAgo = latestSync
    ? formatDistanceToNowStrict(latestSync, {
        addSuffix: true,
      })
    : null;

  return (
    <Card className="col-span-1 flex flex-col ">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <IconHeartRateMonitor className="h-4 w-4 text-red-400" />
          Health
        </CardTitle>
        <CardDescription>Provider connectivity status</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 shadow-inner">
            <div className="text-2xl font-semibold text-green-400">
              {isProviderCountLoading ? "-" : providerCount}
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-neutral-400">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Healthy
            </div>
          </div>
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 shadow-inner">
            <div className="text-2xl font-semibold text-yellow-400">
              {isProviderCountLoading ? "-" : 0}
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-neutral-400">
              <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
              Warning
            </div>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 shadow-inner">
            <div className="text-2xl font-semibold text-red-400">
              {isProviderCountLoading ? "-" : 0}
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-neutral-400">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Error
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800/40 bg-gradient-to-r from-purple-900/10 to-blue-900/10 p-4">
          <div className="mb-2">
            <h5 className="text-sm font-medium text-neutral-200">
              Resource Syncing
            </h5>
            {latestSync == null && (
              <p className="text-xs text-neutral-400">No syncs yet</p>
            )}
            {latestSync != null && (
              <p className="text-xs text-neutral-400">
                Last sync completed {syncedTimeAgo}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-neutral-300">
                Auto-sync enabled
              </span>
            </div>
            <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400">
              Healthy
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h5 className="text-sm font-medium text-neutral-200">
            Recent Issues
          </h5>
          <div className="max-h-[120px] space-y-2 overflow-y-auto pr-1 text-xs">
            <p className="text-neutral-400">No recent issues</p>
            {/* {healthStats.recentIssues.map((issue, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${issue.type === "warning" ? "bg-yellow-500" : "bg-red-500"}`}
                  ></div>
                  <span className="text-neutral-300">{issue.message}</span>
                </div>
                <span className="text-neutral-400">{issue.time}</span>
              </div>
            ))} */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
