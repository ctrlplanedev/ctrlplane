import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { endOfDay, startOfDay, subDays, subWeeks } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { DailyJobsChart } from "./DailyJobsChart";
import { DailyResourceCountGraph } from "./DailyResourcesCountGraph";
import { SuccessRate } from "./overview-cards/SuccessRate";
import { TotalJobs } from "./overview-cards/TotalJobs";
import { WorkspaceResources } from "./overview-cards/WorkspaceResources";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string };
}): Promise<Metadata> => {
  try {
    const workspace = await api.workspace.bySlug(props.params.workspaceSlug);
    return {
      title: `Insights | ${workspace?.name ?? props.params.workspaceSlug} | Ctrlplane`,
      description: `Analytics and performance metrics for the ${workspace?.name ?? props.params.workspaceSlug} workspace.`,
    };
  } catch (error) {
    return {
      title: "Insights | Ctrlplane",
      description:
        "Analytics and performance metrics for your Ctrlplane workspace.",
    };
  }
};

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function InsightsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const endDate = endOfDay(new Date());
  const startDate = startOfDay(subDays(endDate, 30));

  const resources = await api.resource.stats.dailyCount.byWorkspaceId({
    workspaceId: workspace.id,
    startDate,
    endDate,
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const jobs = await api.job.config.byWorkspaceId.dailyCount({
    workspaceId: workspace.id,
    startDate: subWeeks(endDate, 6),
    endDate,
    timezone,
  });

  return (
    <div className="container m-8 mx-auto space-y-4">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-2xl font-bold">Insights</h2>
      </div>
      <div className="flex w-full items-center justify-between gap-4">
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

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Jobs per day</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          <DailyJobsChart dailyCounts={jobs} />
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Resources over 30 days</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] w-full pl-0 pr-6">
          <DailyResourceCountGraph chartData={resources} />
        </CardContent>
      </Card>
    </div>
  );
}
