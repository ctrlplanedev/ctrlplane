import type { RouterOutputs } from "@ctrlplane/trpc";
import { useNavigate, useParams } from "react-router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { WorkflowActionsDropdown } from "./WorkflowActionsDropdown";

type Workflow = RouterOutputs["workflows"]["list"][number];

function WorkflowRow({ workflow }: { workflow: Workflow }) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate(`/${workspaceSlug}/workflows/${workflow.id}`)}
    >
      <TableCell className="font-medium">{workflow.name}</TableCell>
      <TableCell className="text-center font-mono text-sm">
        {workflow.runCount}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <WorkflowActionsDropdown />
      </TableCell>
    </TableRow>
  );
}

export function WorkflowsTable({ workflows }: { workflows: Workflow[] }) {
  const sorted = workflows.sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Table className="border-b">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-center">Runs</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((workflow) => (
          <WorkflowRow key={workflow.id} workflow={workflow} />
        ))}
      </TableBody>
    </Table>
  );
}
