import type * as schema from "@ctrlplane/db/schema";
import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    resourceId: string;
    releaseTargetId: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { releaseTargetId } = await params;
  const releaseTarget = await api.releaseTarget.byId(releaseTargetId);
  if (releaseTarget == null) notFound();
  const { resource, deployment } = releaseTarget;
  return {
    title: `${resource.name} | ${deployment.name}`,
  };
}

const ReleaseTargetsPageHeader: React.FC<{
  workspaceSlug: string;
  resource: schema.Resource;
  deployment: schema.Deployment;
}> = ({ workspaceSlug, resource, deployment }) => {
  const resourceDeploymentsPageUrl = urls
    .workspace(workspaceSlug)
    .resource(resource.id)
    .deployments()
    .baseUrl();

  return (
    <PageHeader className="justify-between">
      <div className="flex shrink-0 items-center gap-4">
        <Link href={resourceDeploymentsPageUrl}>
          <IconArrowLeft className="size-5" />
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-sm text-muted-foreground">
          Deploy {deployment.name} to {resource.name}
        </span>
      </div>
    </PageHeader>
  );
};

export default async function Layout({ children, params }: Props) {
  const { workspaceSlug, releaseTargetId } = await params;

  const releaseTarget = await api.releaseTarget.byId(releaseTargetId);
  if (releaseTarget == null) notFound();

  return (
    <div className="flex h-full flex-col">
      <ReleaseTargetsPageHeader
        workspaceSlug={workspaceSlug}
        {...releaseTarget}
      />
      {children}
    </div>
  );
}
