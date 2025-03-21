import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconChartBar } from "@tabler/icons-react";
import { subMonths } from "date-fns";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarTrigger,
} from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { SidebarLink } from "~/app/[workspaceSlug]/(app)/resources/(sidebar)/SidebarLink";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { DailyResourceCountGraph } from "./insights/DailyResourcesCountGraph";

export default async function EnvironmentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { workspaceSlug, systemSlug, environmentId } = await props.params;
  const environment = await api.environment.byId(environmentId);
  if (environment == null) notFound();

  const endDate = new Date();
  const startDate = subMonths(endDate, 1);

  const resourceCounts = await api.resource.stats.dailyCount.byEnvironmentId({
    environmentId: environment.id,
    startDate,
    endDate,
  });

  const systemUrls = urls.workspace(workspaceSlug).system(systemSlug);
  const environmentUrls = systemUrls.environment(environmentId);
  return (
    <SidebarProvider
      className="flex h-full w-full flex-col"
      sidebarNames={[Sidebars.Environment, Sidebars.EnvironmentAnalytics]}
      defaultOpen={[Sidebars.Environment]}
    >
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={systemUrls.deployments()}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={systemUrls.environments()}>
                  Environments
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{environment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <SidebarTrigger name={Sidebars.EnvironmentAnalytics}>
          <IconChartBar className="h-4 w-4" />
        </SidebarTrigger>
      </PageHeader>

      <div className="relative flex h-full w-full overflow-hidden">
        <Sidebar className="absolute left-0 top-0" name={Sidebars.Environment}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink href={environmentUrls.deployments()}>
                  Deployments
                </SidebarLink>
                <SidebarLink href={environmentUrls.policies()}>
                  Policies
                </SidebarLink>
                <SidebarLink href={environmentUrls.resources()}>
                  Resources
                </SidebarLink>
                <SidebarLink href={environmentUrls.variables()}>
                  Variables
                </SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-56px-64px-2px)] min-w-0 overflow-y-auto">
          {props.children}
        </SidebarInset>
        <Sidebar
          className="absolute right-0 top-0"
          name={Sidebars.EnvironmentAnalytics}
          side="right"
          style={
            {
              "--sidebar-width": "500px",
            } as React.CSSProperties
          }
          gap="w-[500px]"
        >
          <SidebarContent>
            <SidebarGroup>
              <div className="space-y-4 p-4">
                <h2>Resources over 30 days</h2>
                <div className="h-[250px] w-full">
                  <DailyResourceCountGraph chartData={resourceCounts} />
                </div>
              </div>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </SidebarProvider>
  );
}
