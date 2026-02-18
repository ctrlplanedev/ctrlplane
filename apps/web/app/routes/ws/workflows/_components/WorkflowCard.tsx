import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useNavigate } from "react-router";

import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { useWorkspace } from "~/components/WorkspaceProvider";

type WorkflowCardProps = {
  workflow: WorkspaceEngine["schemas"]["Workflow"];
};

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();

  return (
    <Card
      className="cursor-pointer hover:bg-accent"
      onClick={() => navigate(`/${workspace.slug}/workflows/${workflow.id}`)}
    >
      <CardHeader>
        <CardTitle>{workflow.name}</CardTitle>
      </CardHeader>
    </Card>
  );
}
