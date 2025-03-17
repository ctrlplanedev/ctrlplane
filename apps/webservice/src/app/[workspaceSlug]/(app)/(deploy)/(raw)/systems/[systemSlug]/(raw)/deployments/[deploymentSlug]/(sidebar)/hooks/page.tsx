import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { HooksTable } from "./HooksTable";

type PageProps = {
  params: {
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const deployment = await api.deployment.bySlug(params);
  if (!deployment) return notFound();

  return {
    title: `Hooks | ${deployment.name} | ${deployment.system.name}`,
    description: `Manage hooks for ${deployment.name} deployment`,
  };
}

export default async function HooksPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
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
