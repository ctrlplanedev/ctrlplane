import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { CreateWidgetDrawer } from "../_components/widget-drawer/CreateWidgetDrawer";
import { PageHeader } from "../../_components/PageHeader";
import { Dashboard } from "./_components/Dashboard";
import { DashboardContextProvider } from "./_components/DashboardContext";

type PageProps = {
  params: Promise<{ workspaceSlug: string; dashboardId: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { params } = props;
  const { workspaceSlug, dashboardId } = await params;

  const dashboard = await api.dashboard.get(dashboardId);
  if (dashboard == null) return notFound();

  return {
    title: `${dashboard.name} | Dashboards | ${workspaceSlug}`,
  };
}

export default async function DashboardPage(props: PageProps) {
  const { params } = props;
  const { workspaceSlug, dashboardId } = await params;

  const dashboard = await api.dashboard.get(dashboardId);
  if (dashboard == null) return notFound();

  return (
    <div className="h-full w-full">
      <DashboardContextProvider dashboard={dashboard}>
        <PageHeader className="justify-between">
          <div className="flex shrink-0 items-center gap-4">
            <Link href={urls.workspace(workspaceSlug).dashboards()}>
              <IconArrowLeft className="size-5" />
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={urls.workspace(workspaceSlug).dashboards()}
                  >
                    Dashboards
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{dashboard.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <CreateWidgetDrawer />
        </PageHeader>

        <Dashboard />
      </DashboardContextProvider>
    </div>
  );
}
