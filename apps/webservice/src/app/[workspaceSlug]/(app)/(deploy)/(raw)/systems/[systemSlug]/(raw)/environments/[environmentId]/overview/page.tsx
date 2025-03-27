import React from "react";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { OverviewPageContent } from "./OverviewPageContent";

export default async function EnvironmentOverviewPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { environmentId, workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const environment = await api.environment.byId(environmentId);
  if (environment == null) return notFound();

  const stats = await api.environment.page.overview.latestDeploymentStats({
    environmentId,
    workspaceId: workspace.id,
  });

  const deployments = await api.deployment.bySystemId(environment.systemId);

  return (
    <OverviewPageContent
      environment={environment}
      deployments={deployments}
      stats={stats}
    />
  );
}
