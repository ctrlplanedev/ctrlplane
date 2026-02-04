import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";


type WorkflowTemplateCardProps = {
  workflowTemplate: WorkspaceEngine["schemas"]["WorkflowTemplate"];
};




export function WorkflowTemplateCard({ workflowTemplate }: WorkflowTemplateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{workflowTemplate.name}</CardTitle>
      </CardHeader> 
    </Card>
  );
}