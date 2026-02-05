import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkflowTemplate } from "./WorkflowTemplateProvider";

const WorkflowStatusDisplayName = {
  successful: "Successful",
  failed: "Failed",
  inProgress: "In Progress",
  pending: "Pending",
} as const;

const WorkflowStatusBadgeColor: Record<string, string> = {
  successful:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  failed:
    "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  inProgress:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  pending:
    "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800",
};

function getWorkflowStatus(
  workflow: WorkspaceEngine["schemas"]["WorkflowWithJobs"],
): keyof typeof WorkflowStatusDisplayName {
  const { jobs: wfJobs } = workflow;

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

function WorkflowStatusBadge({
  workflow,
}: {
  workflow: WorkspaceEngine["schemas"]["WorkflowWithJobs"];
}) {
  const status = getWorkflowStatus(workflow);
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${WorkflowStatusBadgeColor[status]}`}
    >
      {WorkflowStatusDisplayName[status]}
    </span>
  );
}

export function WorkflowsTable() {
  const { workflowTemplate } = useWorkflowTemplate();
  const { workflows } = workflowTemplate
  const wfsReversed = [...workflows].reverse();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Jobs</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {wfsReversed.map((workflow) => (
          <TableRow key={workflow.id}>
            <TableCell>{workflow.id}</TableCell>
            <TableCell>{workflow.jobs.length}</TableCell>
            <TableCell>
              <WorkflowStatusBadge workflow={workflow} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}