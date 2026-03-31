import { useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { WorkflowRunsTable } from "./_components/WorkflowRunsTable";

function useWorkflowRuns() {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data, isLoading } = trpc.workflows.runs.list.useQuery(
    { workspaceId: workspace.id, workflowId: workflowId! },
    { enabled: workflowId != null },
  );
  return { runs: data ?? [], isLoading };
}

function NoRuns() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 p-6">
      <div className="text-lg font-medium">No runs yet</div>
      <div className="text-sm text-muted-foreground">
        Workflow runs will appear here once triggered
      </div>
    </div>
  );
}

export default function WorkflowRunsPage() {
  const { runs, isLoading } = useWorkflowRuns();

  return (
    <main className="flex-1 overflow-auto">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : runs.length === 0 ? (
        <NoRuns />
      ) : (
        <WorkflowRunsTable runs={runs} />
      )}
    </main>
  );
}
