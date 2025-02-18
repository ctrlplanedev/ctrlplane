import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { endOfDay, startOfDay, subDays } from "date-fns";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@ctrlplane/ui/breadcrumb";

import { api } from "~/trpc/server";
import { PageHeader } from "../_components/PageHeader";
import { DailyJobsChart } from "./DailyJobsChart";
import { SuccessRate } from "./overview-cards/SuccessRate";
import { TotalJobs } from "./overview-cards/TotalJobs";
import { WorkspaceResources } from "./overview-cards/WorkspaceResources";

export const metadata: Metadata = {
  title: "Insights | Ctrlplane",
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

  return (
    <div>
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">Insights</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="container m-8 mx-auto space-y-4">
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

        <DailyJobsChart workspaceId={workspace.id} />
      </div>
    </div>
  );
}
