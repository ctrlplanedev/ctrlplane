import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentVersionJobsTable } from "./_components/DeploymentVersionJobsTable";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  const deploymentVersion = await api.deployment.version.byId(params.releaseId);
  if (deploymentVersion == null) return notFound();

  return {
    title: `${deploymentVersion.tag} | ${deployment.name} | ${deployment.system.name} | ${deployment.system.workspace.name}`,
  };
}

export default async function ReleasePage(props: PageProps) {
  const params = await props.params;
  const deploymentVersion = await api.deployment.version.byId(params.releaseId);
  const deployment = await api.deployment.bySlug(params);
  if (deploymentVersion == null || deployment == null) return notFound();

  return (
    <DeploymentVersionJobsTable
      deploymentVersion={deploymentVersion}
      deployment={deployment}
    />
  );
}
