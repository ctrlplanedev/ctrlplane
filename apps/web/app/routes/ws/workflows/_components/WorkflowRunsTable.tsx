import type { RouterOutputs } from "@ctrlplane/trpc";
import { formatDistanceToNowStrict } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { WorkflowRunStatusBadge } from "./WorkflowRunStatusBadge";

type WorkflowRun = RouterOutputs["workflows"]["runs"]["list"][number];

function timeAgo(date: Date | string | null) {
  if (date == null) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

function WorkflowRunRow({ run }: { run: WorkflowRun }) {
  return (
    <TableRow>
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
