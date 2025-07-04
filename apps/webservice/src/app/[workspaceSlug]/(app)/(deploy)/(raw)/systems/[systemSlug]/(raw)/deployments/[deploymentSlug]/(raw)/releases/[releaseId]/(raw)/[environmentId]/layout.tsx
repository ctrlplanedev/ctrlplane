import React from "react";
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

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

export default async function ReleaseLayout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
    environmentId: string;
  }>;
}) {
  const params = await props.params;
  const version = await api.deployment.version.byId(params.releaseId);
  if (version == null) notFound();

  const environment = await api.environment.byId(params.environmentId);
  if (environment == null) notFound();

  const deployment = await api.deployment.byId(version.deploymentId);
  const systemUrls = urls
    .workspace(params.workspaceSlug)
    .system(params.systemSlug);
  const deploymentUrls = systemUrls.deployment(params.deploymentSlug);
  const releaseUrl = deploymentUrls.release(params.releaseId).jobs();

  return (
    <div className="h-full w-full">
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link href={releaseUrl}>
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={systemUrls.deployments()}>
                  Deployments
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={deploymentUrls.releases()}>
                  {deployment.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={releaseUrl}>{version.tag}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{environment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>
      <div className="flex h-full w-full">{props.children}</div>
    </div>
  );
}
