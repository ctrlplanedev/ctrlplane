import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconChartBar } from "@tabler/icons-react";

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

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { SidebarLink } from "~/app/[workspaceSlug]/(appv2)/resources/(sidebar)/SidebarLink";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { EnvironmentAnalyticsSidebar } from "./EnvironmentAnalyticsSidebar";

export default async function EnvironmentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const params = await props.params;
  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  const url = (tab: string) =>
    `/${params.workspaceSlug}/systems/${params.systemSlug}/environments/${params.environmentId}/${tab}`;
  return (
    <SidebarProvider
      sidebarNames={[Sidebars.Environment, Sidebars.EnvironmentAnalytics]}
      className="flex h-full w-full flex-col"
      defaultOpen={[Sidebars.Environment]}
    >
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`}
          >
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href={`/${params.workspaceSlug}/systems/${params.systemSlug}/environments`}
                >
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

      <div className="relative flex h-full w-full flex-row-reverse overflow-x-hidden">
        <EnvironmentAnalyticsSidebar environmentId={environment.id} />
        <SidebarInset>{props.children}</SidebarInset>
        <Sidebar
          className="absolute left-0 top-0 flex-1"
          name={Sidebars.Environment}
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarLink href={url("deployments")}>Deployments</SidebarLink>
                <SidebarLink href={url("policies")}>Policies</SidebarLink>
                <SidebarLink href={url("workflow")}>Workflow</SidebarLink>
                <SidebarLink href={url("resources")}>Resources</SidebarLink>
                <SidebarLink href={url("variables")}>Variables</SidebarLink>
                <SidebarLink href={url("settings")}>Settings</SidebarLink>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </div>
    </SidebarProvider>
  );
}
