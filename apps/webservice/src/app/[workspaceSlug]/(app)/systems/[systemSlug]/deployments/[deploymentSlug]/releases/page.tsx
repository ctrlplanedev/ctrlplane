"use server";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentPageContent } from "./DeploymentPageContent";

type PageProps = {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
  searchParams: { "release-channel-id"?: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return {
    title: `Releases | ${deployment.name}`,
  };
}

export default async function DeploymentPage({
  params,
  searchParams,
}: PageProps) {
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const { system } = deployment;
  const environments = await api.environment.bySystemId(system.id);
  const releaseChannel = searchParams["release-channel-id"]
    ? await api.deployment.releaseChannel.byId(
        searchParams["release-channel-id"],
      )
    : null;
  return (
    <DeploymentPageContent
      deployment={deployment}
      environments={environments}
      releaseChannel={releaseChannel}
    />
  );
}
