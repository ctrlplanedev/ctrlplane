import { api } from "~/trpc/server";
import { DeploymentVersionChannels } from "./DeploymentVersionChannels";

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
    <DeploymentVersionChannels
      environmentPolicy={policy}
      deployments={deployments}
    />
  );
}
