"use server";

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
  searchParams: Promise<{ "deployment-version-channel-id"?: string }>;
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
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const { system } = deployment;
  const roots = await api.system.directory.listRoots(system.id);
  const { rootEnvironments: environments, directories } = roots;
  const deploymentVersionChannel = searchParams["deployment-version-channel-id"]
    ? await api.deployment.version.channel.byId(
        searchParams["deployment-version-channel-id"],
      )
    : null;

  return (
    <DeploymentPageContent
      workspace={workspace}
      deployment={deployment}
      environments={environments}
      directories={directories}
      deploymentVersionChannel={deploymentVersionChannel}
    />
  );
}
