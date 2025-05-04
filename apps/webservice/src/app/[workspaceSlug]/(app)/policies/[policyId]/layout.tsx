/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
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
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PolicyTabs } from "./_components/PolicyTabs";

export default async function EnvironmentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    policyId: string;
  }>;
}) {
  const { workspaceSlug, policyId } = await props.params;
  const policy = await api.policy.byId({ policyId });
  if (policy == null) notFound();

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader className="z-10 justify-between drop-shadow-lg">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
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
              <BreadcrumbItem>
                <BreadcrumbPage>{policy.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <SidebarTrigger name={Sidebars.EnvironmentAnalytics}>
          <IconChartBar className="h-4 w-4" />
        </SidebarTrigger>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 container mx-auto h-[calc(100vh-56px-64px-2px)] overflow-y-auto py-6">
        <div className="mb-6 flex flex-col space-y-2">
          <h1 className="text-3xl font-bold text-neutral-100">
            {policy.name} Policy
          </h1>
          <p className="text-neutral-400">
            {policy.description || "No description provided"}
          </p>
        </div>

        <PolicyTabs />

        {props.children}
      </div>
    </div>
  );
}
