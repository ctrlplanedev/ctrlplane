import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";

import {
  TabLink,
  Tabs,
  TabsList,
} from "~/app/[workspaceSlug]/(appv2)/_components/navigation/Tabs";
import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";

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
    <div>
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/${params.workspaceSlug}/systems/${params.systemSlug}/environments`}
          >
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Environments List</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="mx-6 mt-4 space-y-2">
        <h1 className="text-2xl font-bold">{environment.name}</h1>
        <Tabs>
          <TabsList>
            <TabLink href={url("resources")}>Targets</TabLink>
            <TabLink href={url("config")}>Configuration</TabLink>
            <TabLink href={url("deployments")}>Deployments</TabLink>
            <TabLink href={url("policies")}>Policies</TabLink>
            <TabLink href={url("variables")}>Variables</TabLink>
          </TabsList>
        </Tabs>
        {props.children}
      </div>
    </div>
  );
}
