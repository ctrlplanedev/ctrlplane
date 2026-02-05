import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { WorkflowTriggerForm } from "./WorkflowTriggerForm";

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