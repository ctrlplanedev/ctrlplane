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

export default async function DeploymentLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();

  return (
    <div>
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
                <BreadcrumbPage>Environments List</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="mx-6 mt-4 space-y-2">
        <h1 className="text-2xl font-bold">{deployment.name}</h1>
        <Tabs>
          <TabsList>
            <TabLink href="?tab=resources" isActive>
              Deployment Targets
            </TabLink>
            <TabLink href="?tab=deployments">Deployments</TabLink>
            <TabLink href="?tab=policies">Policies</TabLink>
            <TabLink href="?tab=variables">Variables</TabLink>
          </TabsList>
        </Tabs>
        {props.children}
      </div>
    </div>
  );
}
