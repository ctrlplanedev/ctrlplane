import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { DeploymentVersionChannelsTable } from "./DeploymentVersionChannelsTable";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return {
    title: `Channels | ${deployment.name} | ${deployment.system.name}`,
    description: `Manage version channels for ${deployment.name} deployment`,
  };
}

export default async function DeploymentVersionChannelsPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;

  const { workspaceSlug, systemSlug, deploymentSlug } = params;

  const deployment = await api.deployment.bySlug({
    workspaceSlug,
    systemSlug,
    deploymentSlug,
  });
  if (!deployment) notFound();

  const deploymentVersionChannels =
    await api.deployment.version.channel.list.byDeploymentId(deployment.id);

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-full overflow-auto">
      <DeploymentVersionChannelsTable
        deploymentVersionChannels={deploymentVersionChannels}
      />
    </div>
  );
}
