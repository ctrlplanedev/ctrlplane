import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { HooksTable } from "./HooksTable";

export default async function HooksPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (!workspace) notFound();

  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);

  const deployment = await api.deployment.bySlug(params);
  if (!deployment) notFound();

  const hooks = await api.deployment.hook.list(deployment.id);
  return (
    <HooksTable hooks={hooks} jobAgents={jobAgents} workspace={workspace} />
  );
}
