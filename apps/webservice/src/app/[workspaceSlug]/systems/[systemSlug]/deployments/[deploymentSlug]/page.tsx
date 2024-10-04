"use server";

import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentPageContent } from "./DeploymentPageContent";

export default async function DeploymentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const system = await api.system.bySlug(params);
  const environments = await api.environment.bySystemId(system.id);
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return (
    <DeploymentPageContent
      deployment={deployment}
      environments={environments}
    />
  );
}
