import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { CreateRunbook } from "./CreateRunbookForm";

export const metadata: Metadata = {
  title: "Create Runbook",
  description: "Create a new runbook for your system",
};

type PageProps = {
  params: {
    workspaceSlug: string;
    systemSlug: string;
  };
};

export default async function CreateRunbookPage({ params }: PageProps) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  const system = await api.system.bySlug(params).catch(notFound);
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);
  return (
    <div className="h-full overflow-y-auto p-8 py-16 pb-24">
      <CreateRunbook
        jobAgents={jobAgents}
        system={system}
        workspace={workspace}
      />
    </div>
  );
}
