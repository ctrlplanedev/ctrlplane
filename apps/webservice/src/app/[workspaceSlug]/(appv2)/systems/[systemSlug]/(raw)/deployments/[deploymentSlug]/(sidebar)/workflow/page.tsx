import { notFound } from "next/navigation";

import { api } from "~/trpc/server";
import { JobAgentSection } from "./JobAgentSection";

export default async function WorkflowPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const workspaceId = workspace.id;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const jobAgents = await api.job.agent.byWorkspaceId(workspaceId);
  const jobAgent = jobAgents.find((a) => a.id === deployment.jobAgentId);

  return (
    <div className="container">
      <JobAgentSection
        jobAgents={jobAgents}
        workspace={workspace}
        jobAgent={jobAgent}
        jobAgentConfig={deployment.jobAgentConfig}
        deploymentId={deployment.id}
      />
    </div>
  );
}
