import { notFound } from "next/navigation";
import { IconFilter, IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PageHeader } from "../../../_components/PageHeader";
import { VersionConditionsPoliciesTable } from "./_components/VersionConditionsPoliciesTable";

export default async function VersionConditionsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const policies = await api.policy.list(workspace.id);

  const policiesWithVersionConditions = policies.filter(
    (policy) => policy.deploymentVersionSelector != null,
  );

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
                <BreadcrumbPage>Version Conditions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <div className="mb-4">
          <div className="mb-1 flex items-center">
            <IconFilter className="mr-2 h-5 w-5 text-purple-400" />
            <span>Deployment Version Selectors</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Policies with rules that filter which deployment versions can be
            released
          </div>
        </div>
        <div>
          {policiesWithVersionConditions.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                No policies with version conditions found
              </p>
            </div>
          ) : (
            <VersionConditionsPoliciesTable
              policies={policiesWithVersionConditions}
            />
          )}
        </div>
      </div>
    </div>
  );
}
