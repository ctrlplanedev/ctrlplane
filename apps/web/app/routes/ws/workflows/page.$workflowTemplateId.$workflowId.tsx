import { Link, useParams } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useWorkflowTemplate } from "./_components/WorkflowTemplateProvider";
import { WorkflowJobCard } from "./_components/WorkflowCard";
import { Label } from "~/components/ui/label";

export function meta() {
  return [
    { title: "Workflow - Ctrlplane" },
    { name: "description", content: "View workflow details" },
  ];
}

function PageHeader() {
  const { workflowTemplate } = useWorkflowTemplate();
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
            <Link to={`/${workspace.slug}/workflows/${workflowTemplate.id}`}>
              {workflowTemplate.name}
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

export default function WorkflowPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { workflowTemplate } = useWorkflowTemplate();

  const workflow = workflowTemplate.workflows.find((w) => w.id === workflowId);

  if (workflow == null)
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
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-semibold">Workflow {workflowId}</h1>

        <div className="space-y-2 w-96">
          <Label>Inputs</Label>
          <pre className="text-sm bg-muted p-2 rounded-md">{JSON.stringify(workflow.inputs, null, 2)}</pre>
        </div>

        <div className="space-y-2">
          <Label>Workflow Jobs</Label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflow.jobs.map((job) => (
              <WorkflowJobCard key={job.id} workflowJob={job} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
