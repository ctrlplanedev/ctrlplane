import { Link, useParams } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { WorkflowJobCard } from "./_components/WorkflowJobCard";
import { useWorkflow } from "./_components/WorkflowProvider";

export function meta() {
  return [
    { title: "Workflow - Ctrlplane" },
    { name: "description", content: "View workflow details" },
  ];
}

function PageHeader() {
  const { workflow } = useWorkflow();
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
            <Link to={`/${workspace.slug}/workflows/${workflow.id}`}>
              {workflow.name}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{workflowId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

function RunHeader() {
  const { workflow } = useWorkflow();
  const { workflowRunId } = useParams<{ workflowRunId: string }>();
  const { name } = workflow;

  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-xl font-semibold">{name}</h1>
      <p className="text-sm text-muted-foreground">Run {workflowRunId}</p>
    </div>
  );
}

export default function WorkflowPage() {
  const { workflowRunId } = useParams<{ workflowRunId: string }>();
  const { workflow } = useWorkflow();

  const workflowRun = workflow.workflowRuns.find((w) => w.id === workflowRunId);

  if (workflowRun == null)
    return (
      <>
        <PageHeader />
        <div className="flex h-full items-center justify-center p-4">
          <p className="text-muted-foreground">Workflow not found</p>
        </div>
      </>
    );

  return (
    <>
      <PageHeader />
      <div className="space-y-4 p-4">
        <RunHeader />

        <div className="w-96 space-y-2">
          <Label>Inputs</Label>
          <pre className="rounded-md bg-muted p-2 text-sm">
            {JSON.stringify(workflow.inputs, null, 2)}
          </pre>
        </div>

        <div className="space-y-2">
          <Label>Jobs</Label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflowRun.jobs.map((job) => (
              <WorkflowJobCard key={job.id} workflowJob={job} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
