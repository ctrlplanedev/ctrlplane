import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";

import { api } from "~/trpc/server";
import { PageHeader } from "../_components/PageHeader";
import { CreateDashboardDialog } from "./_components/CreateDashboardDialog";
import { DashboardsTable } from "./_components/DashboardsTable";

type PageProps = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  return {
    title: `Dashboards | ${params.workspaceSlug}`,
  };
}

export default async function Page(props: PageProps) {
  const { params } = props;
  const { workspaceSlug } = await params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const dashboards = await api.dashboard.byWorkspaceId(workspace.id);

  return (
    <div className="h-full w-full">
      <PageHeader className="justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboards</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CreateDashboardDialog workspaceId={workspace.id} />
      </PageHeader>

      <DashboardsTable dashboards={dashboards} />
    </div>
  );
}
