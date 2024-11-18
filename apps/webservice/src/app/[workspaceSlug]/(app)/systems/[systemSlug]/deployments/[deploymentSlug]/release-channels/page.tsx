import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ReleaseChannelsTable } from "./ReleaseChannelsTable";

export default async function ReleaseChannelsPage({
  params: { workspaceSlug, systemSlug, deploymentSlug },
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = await api.deployment.bySlug({
    workspaceSlug,
    systemSlug,
    deploymentSlug,
  });
  if (!deployment) notFound();

  const releaseChannels =
    await api.deployment.releaseChannel.list.byDeploymentId(deployment.id);

  return <ReleaseChannelsTable releaseChannels={releaseChannels} />;
}
