import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useWorkflow } from "./WorkflowProvider";

const WorkflowRunStatusDisplayName = {
  successful: "Successful",
  failed: "Failed",
  inProgress: "In Progress",
  pending: "Pending",
} as const;

const WorkflowRunStatusBadgeColor: Record<string, string> = {
  successful:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  failed:
    "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  inProgress:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  pending:
    "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800",
};

function getWorkflowRunStatus(
  workflowRun: WorkspaceEngine["schemas"]["WorkflowRunWithJobs"],
): keyof typeof WorkflowRunStatusDisplayName {
  const { jobs: wfJobs } = workflowRun;

  if (
    wfJobs.every((wfJob) =>
      wfJob.jobs.every((job) => job.status === "successful"),
    )
  )
    return "successful";

  if (
    wfJobs.some((wfJob) =>
      wfJob.jobs.some(
        (job) =>
          job.status === "failure" ||
          job.status === "invalidIntegration" ||
          job.status === "invalidJobAgent" ||
          job.status === "externalRunNotFound",
      ),
    )
  )
    return "failed";

  if (
    wfJobs.some((wfJob) =>
      wfJob.jobs.some(
        (job) =>
          job.status === "inProgress" ||
          job.status === "actionRequired" ||
          job.status === "pending",
      ),
    )
  )
    return "inProgress";

  return "pending";
}

function workflowRunCreatedAt(
  workflowRun: WorkspaceEngine["schemas"]["WorkflowRunWithJobs"],
) {
  const dateStr = _.chain(workflowRun.jobs)
    .flatMap((wfJob) => wfJob.jobs)
    .map((job) => job.createdAt)
    .min()
    .value();
  if (dateStr == null) return null;
  return new Date(dateStr);
}

function WorkflowRunStatusBadge({
  workflowRun,
}: {
  workflowRun: WorkspaceEngine["schemas"]["WorkflowRunWithJobs"];
}) {
  const status = getWorkflowRunStatus(workflowRun);
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${WorkflowRunStatusBadgeColor[status]}`}
    >
      {WorkflowRunStatusDisplayName[status]}
    </span>
  );
}

function useWorkflowLink(workflowId: string) {
  const { workspace } = useWorkspace();
  const { workflow } = useWorkflow();
  return `/${workspace.slug}/workflows/${workflow.id}/${workflowId}`;
}

function WorkflowRunRow({
  workflowRun,
}: {
  workflowRun: WorkspaceEngine["schemas"]["WorkflowRunWithJobs"];
}) {
  const createdAt = workflowRunCreatedAt(workflowRun);
  const workflowLink = useWorkflowLink(workflowRun.id);

  return (
    <TableRow key={workflowRun.id}>
      <TableCell>
        <a href={workflowLink} className="cursor-pointer hover:underline">
          {workflowRun.id}
        </a>
      </TableCell>
      <TableCell>{workflowRun.jobs.length}</TableCell>
      <TableCell>
        <WorkflowRunStatusBadge workflowRun={workflowRun} />
      </TableCell>
      <TableCell>
        {createdAt != null ? (
          formatDistanceToNowStrict(createdAt, { addSuffix: true })
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function WorkflowsTable() {
  const { workflow } = useWorkflow();
  const { workflowRuns } = workflow;
  const wfrunsReversed = [...workflowRuns].reverse();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow ID</TableHead>
          <TableHead>Workflow Jobs</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {wfrunsReversed.map((workflowRun) => (
          <WorkflowRunRow key={workflowRun.id} workflowRun={workflowRun} />
        ))}
      </TableBody>
    </Table>
  );
}
