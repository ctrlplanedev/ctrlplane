import { Link } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useWorkflow } from "./_components/WorkflowProvider";
import { WorkflowsTable } from "./_components/WorkflowsTable";
import { WorkflowTriggerForm } from "./_components/WorkflowTriggerForm";

export function meta() {
  return [
    { title: "Workflow Template - Ctrlplane" },
    { name: "description", content: "View workflow template details" },
  ];
}

function TriggerWorkflowDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Trigger Workflow</Button>
      </DialogTrigger>
      <DialogContent>
        <WorkflowTriggerForm />
      </DialogContent>
    </Dialog>
  );
}

function PageHeader() {
  const { workflow } = useWorkflow();
  const { workspace } = useWorkspace();
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
      <div className="flex items-center gap-2 px-4">
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
              <BreadcrumbPage>{workflow.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <TriggerWorkflowDialog />
    </header>
  );
}

export default function WorkflowPage() {
  return (
    <>
      <PageHeader />
      <WorkflowsTable />
    </>
  );
}
