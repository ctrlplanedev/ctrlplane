import { Outlet, useParams } from "react-router";

import type { Workflow } from "./_components/WorkflowProvider";
import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { WorkflowProvider } from "./_components/WorkflowProvider";

function useWorkflow() {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflow, isLoading } = trpc.workflows.get.useQuery({
    workspaceId: workspace.id,
    workflowId: workflowId ?? "",
  });
  return { workflow, isLoading };
}

function useWorkflowRuns() {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflowRuns, isLoading } = trpc.workflows.runs.list.useQuery({
    workspaceId: workspace.id,
    workflowId: workflowId ?? "",
  });
  return { workflowRuns: workflowRuns?.items ?? [], isLoading };
}

export default function WorkflowsLayout() {
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow();
  const { workflowRuns, isLoading: isWorkflowRunsLoading } = useWorkflowRuns();

  if (isWorkflowLoading || isWorkflowRunsLoading) return <Spinner />;

  if (workflow == null) throw new Error("Workflow not found");

  const wf: Workflow = { ...workflow, workflowRuns };

  return (
    <WorkflowProvider workflow={wf}>
      <Outlet />
    </WorkflowProvider>
  );
}
