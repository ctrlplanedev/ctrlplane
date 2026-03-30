import { Link, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
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

function useWorkflow() {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data } = trpc.workflows.list.useQuery({
    workspaceId: workspace.id,
  });
  return data?.find((w) => w.id === workflowId);
}

function WorkflowPageHeader({ name }: { name: string }) {
  const { workspace } = useWorkspace();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link to={`/${workspace.slug}/workflows`}>Workflows</Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
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

export default function WorkflowDetailPage() {
  const workflow = useWorkflow();
  const { runs, isLoading } = useWorkflowRuns();

  return (
    <>
      <WorkflowPageHeader name={workflow?.name ?? "..."} />

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
    </>
  );
}
