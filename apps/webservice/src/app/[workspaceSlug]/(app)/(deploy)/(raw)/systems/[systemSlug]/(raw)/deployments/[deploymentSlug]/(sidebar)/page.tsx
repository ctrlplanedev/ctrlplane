import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentPageContent } from "./DeploymentPageContent";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { params } = props;
  const deployment = await api.deployment.bySlug(await params);
  if (!deployment) return notFound();

  return {
    title: `Releases | ${deployment.name}`,
  };
}

export default async function DeploymentPage(props: PageProps) {
  const { params } = props;
  const resolvedParams = await params;

  // Fetch workspace and validate
  const workspace = await api.workspace.bySlug(resolvedParams.workspaceSlug);
  if (!workspace) return notFound();

  // Fetch deployment and validate
  const deployment = await api.deployment.bySlug(resolvedParams);
  if (!deployment) return notFound();

  const { system } = deployment;
  const environments = await api.environment.bySystemId(system.id);

  return (
    <DeploymentPageContent
      workspace={workspace}
      deployment={deployment}
      environments={environments}
    />
  );
}
