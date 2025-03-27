"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { IconDeviceDesktopAnalytics, IconMenu2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { buttonVariants } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { HealthCard } from "./_components/HealthCard";
import { ProvidersGrid } from "./_components/ProvidersGrid";
import { ProviderStatisticsCard } from "./_components/ProviderStatisticsCard";
import { ResourceDistributionCard } from "./_components/ResourceDistributionCard";

export const ProviderPageContent: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => {
  const integrationsUrl = urls
    .workspace(workspace.slug)
    .resources()
    .providers()
    .integrations()
    .baseUrl();

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Resources}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Providers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
            href={integrationsUrl}
          >
            Add Provider
          </Link>
        </div>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex flex-1 flex-col gap-6 overflow-y-auto p-6 ">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400">
            <IconDeviceDesktopAnalytics className="h-5 w-5" />
          </span>
          Insights
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <ProviderStatisticsCard workspaceId={workspace.id} />
          <ResourceDistributionCard workspaceId={workspace.id} />
          <HealthCard workspaceId={workspace.id} />
        </div>

        <ProvidersGrid workspaceId={workspace.id} />
      </div>
    </div>
  );
};
