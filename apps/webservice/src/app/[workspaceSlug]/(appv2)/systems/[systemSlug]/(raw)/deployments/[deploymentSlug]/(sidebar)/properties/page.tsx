import React from "react";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditDeploymentSection } from "./EditDeploymentSection";

export default async function DeploymentPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const workspaceId = workspace.id;
  const { items: systems } = await api.system.list({ workspaceId });
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return (
    <div className="container mx-auto max-w-5xl overflow-y-auto">
      <EditDeploymentSection
        deployment={deployment}
        systems={systems}
        workspaceId={workspaceId}
      />
    </div>
  );
}
