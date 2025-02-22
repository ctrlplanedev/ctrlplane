"use server";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { CreateReleaseDialog } from "./CreateRelease";
import { DeploymentPageContent } from "./DeploymentPageContent";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
  searchParams: Promise<{ "release-channel-id"?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return {
    title: `Releases | ${deployment.name}`,
  };
}

export default async function DeploymentPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const { system } = deployment;
  const environments = await api.environment.bySystemId(system.id);
  const releaseChannel = searchParams["release-channel-id"]
    ? await api.deployment.releaseChannel.byId(
        searchParams["release-channel-id"],
      )
    : null;
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
              <BreadcrumbItem>
                <BreadcrumbPage>Releases</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <CreateReleaseDialog deploymentId={deployment.id} systemId={system.id}>
          <Button variant="outline" size="sm">
            Create Release
          </Button>
        </CreateReleaseDialog>
      </PageHeader>
      <DeploymentPageContent
        deployment={deployment}
        environments={environments}
        releaseChannel={releaseChannel}
      />
    </div>
  );
}
