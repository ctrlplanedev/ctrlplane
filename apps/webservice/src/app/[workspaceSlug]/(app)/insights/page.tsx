import type {
  StatsColumn,
  StatsOrder,
} from "@ctrlplane/validators/deployments";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { endOfDay, startOfDay, subDays, subWeeks } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { DailyJobsChart } from "./DailyJobsChart";
import { DailyResourceCountGraph } from "./DailyResourcesCountGraph";
import { DeploymentPerformance } from "./DeploymentPerformance";
import { InsightsFilters } from "./InsightsFilters";
import { SuccessRate } from "./overview-cards/SuccessRate";
import { TotalJobs } from "./overview-cards/TotalJobs";
import { WorkspaceResources } from "./overview-cards/WorkspaceResources";
import { ResourceTypeBreakdown } from "./ResourceTypeBreakdown";
import { SystemHealthOverview } from "./SystemHealthOverview";

export const metadata: Metadata = {
  title: "Insights | Ctrlplane",
};

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: {
    systemId?: string;
    resourceKind?: string;
    timeRange?: string;
  };
};

export default async function InsightsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const { systemId, timeRange = "30" } = props.searchParams ?? {};

  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  // Calculate date range based on timeRange param (default to 30 days)
  const days = parseInt(timeRange, 10) || 30;
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(subDays(endDate, days));

  // Get systems for the filter dropdown
  const systems = await api.system.list({
    workspaceId: workspace.id,
    limit: 100,
    offset: 0,
  });

  // Get resources stats with optional filtering
  const resources = await api.resource.stats.dailyCount.byWorkspaceId({
    workspaceId: workspace.id,
    startDate,
    endDate,
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Get jobs stats with optional filtering by system
  const jobsParams = {
    workspaceId: workspace.id,
    startDate: subWeeks(endDate, 6),
    endDate,
    timezone,
  };

  const jobs = await api.job.config.byWorkspaceId.dailyCount(jobsParams);

  // Get deployment stats with filtering
  const deploymentStatsParams = {
    startDate,
    endDate,
    timezone,
    orderBy: "last-run-at",
    order: "desc",
    ...(systemId ? { systemId } : { workspaceId: workspace.id }),
  };
  const deploymentStats = await api.deployment.stats.byWorkspaceId({
    ...deploymentStatsParams,
    orderBy: "last-run-at" as StatsColumn,
    order: "desc" as StatsOrder,
  });

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header with filters on right */}
      <div className="mb-6 flex w-full items-center justify-between">
        <h2 className="text-2xl font-semibold">Insights</h2>

        <InsightsFilters
          workspaceSlug={workspaceSlug}
          systems={systems.items}
          currentSystemId={systemId}
          currentTimeRange={timeRange}
        />
      </div>

      {/* Overview metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WorkspaceResources workspaceId={workspace.id} />
        <TotalJobs
          workspaceId={workspace.id}
          startDate={startDate}
          endDate={endDate}
        />
        <SuccessRate
          workspaceId={workspace.id}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* Activity trends section */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Activity Trends
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Jobs per day</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] w-full">
              <DailyJobsChart dailyCounts={jobs} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Resources over {days} days
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] w-full">
              <DailyResourceCountGraph chartData={resources} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Distribution & Health section */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Distribution & Health
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ResourceTypeBreakdown
            workspaceId={workspace.id}
            systemId={systemId}
          />

          {systemId ? (
            <SystemHealthOverview
              systemId={systemId}
              workspaceId={workspace.id}
            />
          ) : (
            <Card className="h-[350px] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  System Health Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="flex h-full items-center justify-center">
                <div className="max-w-md p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Select a system from the dropdown above to view health
                    information about environments and resources.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Performance section */}
      <div>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Performance Metrics
        </h3>
        <DeploymentPerformance
          deployments={deploymentStats}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
}
