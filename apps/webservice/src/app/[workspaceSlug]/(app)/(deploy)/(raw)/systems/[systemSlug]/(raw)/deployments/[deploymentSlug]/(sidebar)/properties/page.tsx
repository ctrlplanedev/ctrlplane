import type { Metadata } from "next";
import React from "react";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditDeploymentSection } from "./EditDeploymentSection";

export const metadata: Metadata = { title: "Deployment Properties" };

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
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 w-full overflow-y-auto">
      <div className="container mx-auto max-w-3xl py-8">
        <EditDeploymentSection deployment={deployment} systems={systems} />
      </div>
    </div>
  );
}
