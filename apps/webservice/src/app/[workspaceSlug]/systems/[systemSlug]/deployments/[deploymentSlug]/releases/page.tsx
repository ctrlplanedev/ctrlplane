"use server";

import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentPageContent } from "./DeploymentPageContent";

export default async function DeploymentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const { system } = deployment;
  const environments = await api.environment.bySystemId(system.id);
  return (
    <DeploymentPageContent
      deployment={deployment}
      environments={environments}
    />
  );
}
