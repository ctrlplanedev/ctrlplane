import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { ReleaseChannelsTable } from "./ReleaseChannelsTable";

export default async function ReleaseChannelsPage(props: {
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

  const releaseChannels =
    await api.deployment.releaseChannel.list.byDeploymentId(deployment.id);

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-full overflow-auto">
      <ReleaseChannelsTable releaseChannels={releaseChannels} />
    </div>
  );
}
