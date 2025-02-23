import { api } from "~/trpc/server";
import { ReleaseChannels } from "./ReleaseChannels";

export default async function ChannelsPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>;
}) {
  const { workspaceSlug, systemSlug, environmentId } = await props.params;
  const policyPromise = api.environment.policy.byEnvironmentId(environmentId);
  const systemPromise = api.system.bySlug({ workspaceSlug, systemSlug });
  const [policy, system] = await Promise.all([policyPromise, systemPromise]);

  const deployments = await api.deployment.bySystemId(system.id);

  return (
    <ReleaseChannels environmentPolicy={policy} deployments={deployments} />
  );
}
