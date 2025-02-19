import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { EditRunbook } from "./EditRunbook";

export default async function RunbookSettingsPage(props: {
  params: Promise<{ workspaceSlug: string; runbookId: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);
  const runbook = await api.runbook.byId(params.runbookId);
  if (runbook == null) return notFound();

  const jobAgent = jobAgents.find((ja) => ja.id === runbook.jobAgentId);
  if (jobAgent == null) return notFound();

  return (
    <div className="flex justify-center py-6">
      <div className="max-w-2xl">
        <EditRunbook
          runbook={runbook}
          jobAgents={jobAgents}
          jobAgent={jobAgent}
          workspace={workspace}
        />
      </div>
    </div>
  );
}
