import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { JobAgentConfigForm } from "./JobAgentConfigForm";

export default async function ConfigureJobAgentPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (!deployment) notFound();
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (!workspace) notFound();
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);

  return <JobAgentConfigForm jobAgents={jobAgents} deployment={deployment} />;
}
