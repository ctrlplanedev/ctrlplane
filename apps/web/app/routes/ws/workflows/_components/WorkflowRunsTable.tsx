import type { RouterOutputs } from "@ctrlplane/trpc";
import { useNavigate, useParams } from "react-router";

import { useWorkspace } from "~/components/WorkspaceProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { safeFormatDistanceToNowStrict } from "~/lib/date";
import { WorkflowRunStatusBadge } from "./WorkflowRunStatusBadge";

type WorkflowRun = RouterOutputs["workflows"]["runs"]["list"][number];

function timeAgo(date: Date | string | null) {
  if (date == null) return "-";
  return safeFormatDistanceToNowStrict(date, { addSuffix: true }) ?? "-";
}

function WorkflowRunRow({ run }: { run: WorkflowRun }) {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        navigate(
          `/${workspace.slug}/workflows/${workflowId}/runs/${run.id}`,
        )
      }
    >
      <TableCell className="font-mono text-xs text-muted-foreground">
        {run.id.slice(0, 8)}
      </TableCell>
      <TableCell className="text-center font-mono text-sm">
        {run.inputCount}
      </TableCell>
      <TableCell className="text-center font-mono text-sm">
        {run.jobCount}
      </TableCell>
      <TableCell>
        <WorkflowRunStatusBadge statuses={run.statuses} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {timeAgo(run.createdAt)}
      </TableCell>
    </TableRow>
  );
}

export function WorkflowRunsTable({ runs }: { runs: WorkflowRun[] }) {
  return (
    <Table className="border-b">
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead className="text-center">Inputs</TableHead>
          <TableHead className="text-center">Jobs</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <WorkflowRunRow key={run.id} run={run} />
        ))}
      </TableBody>
    </Table>
  );
}
