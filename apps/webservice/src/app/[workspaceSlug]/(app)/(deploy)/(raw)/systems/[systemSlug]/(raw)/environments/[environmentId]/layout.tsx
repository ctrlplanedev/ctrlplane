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
import { EnvironmentTabs } from "./_components/EnvironmentTabs";

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

  const system = await api.system.bySlug({
    workspaceSlug,
    systemSlug,
  });

  const systemUrls = urls.workspace(workspaceSlug).system(systemSlug);

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader className="z-10 justify-between drop-shadow-lg">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={urls.workspace(workspaceSlug).baseUrl()}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={systemUrls.baseUrl()}>
                  {system.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
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

      <div className="container mx-auto space-y-8 py-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold text-neutral-100">
            {environment.name} Environment
          </h1>
          <p className="text-neutral-400">{environment.description}</p>
        </div>

        <EnvironmentTabs />

        {props.children}
      </div>
    </div>
  );
}
