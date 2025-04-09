import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PageHeader } from "../../../_components/PageHeader";
import { CreateDenyRuleDialog } from "./_components/CreateDenyRule";

export default async function DenyWindowsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Policies}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href={urls.workspace(workspaceSlug).policies().baseUrl()}
                >
                  Policies
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Deny Windows</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Deny Windows</CardTitle>
            <CardDescription>
              Deny windows define scheduled periods for system updates and
              deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Deny window rules let you schedule regular deployment windows
              with:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Weekly, monthly or custom recurrence patterns</li>
              <li>Configurable duration and timing</li>
              <li>Advance notifications to stakeholders</li>
              <li>Override capabilities for emergency deployments</li>
            </ul>
          </CardContent>
        </Card>

        <CreateDenyRuleDialog workspaceId={workspace.id} />
      </div>
    </div>
  );
}
