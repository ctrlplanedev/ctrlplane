import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { WorkflowsPageHeader } from "./_components/WorkflowsPageHeader";
import { WorkflowsTable } from "./_components/WorkflowsTable";

export function meta() {
  return [
    { title: "Workflows - Ctrlplane" },
    { name: "description", content: "Manage your workflows" },
  ];
}

function useWorkflows() {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.workflows.list.useQuery({
    workspaceId: workspace.id,
  });
  return { workflows: data ?? [], isLoading };
}

function NoWorkflows() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 p-6">
      <div className="text-lg font-medium">No workflows found</div>
      <div className="text-sm text-muted-foreground">
        Workflows will appear here once created
      </div>
    </div>
  );
}

export default function Workflows() {
  const { workflows, isLoading } = useWorkflows();

  return (
    <>
      <WorkflowsPageHeader total={workflows.length} />

      <main className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : workflows.length === 0 ? (
          <NoWorkflows />
        ) : (
          <WorkflowsTable workflows={workflows} />
        )}
      </main>
    </>
  );
}
