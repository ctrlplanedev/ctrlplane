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
    <div className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 w-full overflow-y-auto">
      <div className="container max-w-3xl py-4">
        <EditDeploymentSection
          deployment={deployment}
          systems={systems}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
