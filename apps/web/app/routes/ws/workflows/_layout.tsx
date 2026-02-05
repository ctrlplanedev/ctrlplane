import { Outlet, useParams } from "react-router";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { trpc } from "~/api/trpc";
import { Spinner } from "~/components/ui/spinner";
import { WorkflowTemplateProvider, type WorkflowTemplate } from "./_components/WorkflowTemplateProvider";

function useWorkflowTemplate() {
  const { workspace } = useWorkspace();
  const { workflowTemplateId } = useParams<{ workflowTemplateId: string }>();
  const { data: workflowTemplate, isLoading } = trpc.workflows.templates.get.useQuery({ workspaceId: workspace.id, workflowTemplateId: workflowTemplateId ?? "" });
  return { workflowTemplate, isLoading };
}

function useTemplateWorkflows() {
  const { workspace } = useWorkspace();
  const { workflowTemplateId } = useParams<{ workflowTemplateId: string }>();
  const { data: workflows, isLoading } = trpc.workflows.templates.workflows.useQuery({ workspaceId: workspace.id, workflowTemplateId: workflowTemplateId ?? "" });
  return { workflows: workflows?.items ?? [], isLoading };
}

export default function WorkflowsLayout() {
  const { workflowTemplate, isLoading: isWorkflowTemplateLoading } = useWorkflowTemplate();
  const { workflows, isLoading: isTemplateWorkflowsLoading } = useTemplateWorkflows();

  if (isWorkflowTemplateLoading || isTemplateWorkflowsLoading)
    return <Spinner />;

  if (workflowTemplate == null) throw new Error("Workflow template not found");

  const wfTemplate: WorkflowTemplate = {
    ...workflowTemplate,
    workflows,
  };

  return (
    <WorkflowTemplateProvider workflowTemplate={wfTemplate}>
      <Outlet />
    </WorkflowTemplateProvider>
  );
}