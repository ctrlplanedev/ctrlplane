import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { endOfDay, startOfDay, subDays, subWeeks } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/server";
import { DailyJobsChart } from "./DailyJobsChart";
import { DailyResourceCountGraph } from "./DailyResourcesCountGraph";
import { SuccessRate } from "./overview-cards/SuccessRate";
import { TotalJobs } from "./overview-cards/TotalJobs";
import { WorkspaceResources } from "./overview-cards/WorkspaceResources";
import { InsightsFilters } from "./InsightsFilters";
import { ResourceTypeBreakdown } from "./ResourceTypeBreakdown";
import { SystemHealthOverview } from "./SystemHealthOverview";
import { DeploymentPerformance } from "./DeploymentPerformance";

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
  const { systemId, resourceKind, timeRange = "30" } = props.searchParams || {};
  
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

  const deploymentStats = await api.deployment.stats.byWorkspaceId(
    deploymentStatsParams
  );

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header with filters on right */}
      <div className="flex w-full items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Insights</h2>
        
        <InsightsFilters 
          workspaceSlug={workspaceSlug}
          systems={systems.items}
          currentSystemId={systemId}
          currentTimeRange={timeRange}
        />
      </div>

      {/* Overview metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-medium mb-3">Activity Trends</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              <CardTitle className="text-base">Resources over {days} days</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] w-full">
              <DailyResourceCountGraph chartData={resources} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Distribution & Health section */}
      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-medium mb-3">Distribution & Health</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            <Card className="shadow-sm h-[350px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">System Health Overview</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center p-4 max-w-md">
                  <p className="text-muted-foreground text-sm">
                    Select a system from the dropdown above to view health information about environments and resources.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Performance section */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-medium mb-3">Performance Metrics</h3>
        <DeploymentPerformance
          deployments={deploymentStats}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
}