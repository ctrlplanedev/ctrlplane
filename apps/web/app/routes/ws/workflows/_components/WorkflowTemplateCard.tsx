import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useNavigate } from "react-router";

import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { useWorkspace } from "~/components/WorkspaceProvider";

type WorkflowTemplateCardProps = {
  workflowTemplate: WorkspaceEngine["schemas"]["WorkflowTemplate"];
};

export function WorkflowTemplateCard({ workflowTemplate }: WorkflowTemplateCardProps) {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();

  return (
    <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate(`/${workspace.slug}/workflows/${workflowTemplate.id}`)}>
      <CardHeader>
        <CardTitle>{workflowTemplate.name}</CardTitle>
      </CardHeader>
    </Card>
  );
}