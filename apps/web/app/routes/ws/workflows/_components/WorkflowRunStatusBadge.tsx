import { JobStatusBadge } from "~/routes/ws/_components/JobStatusBadge";

function summarizeStatuses(statuses: string[]): string {
  if (statuses.length === 0) return "pending";
  if (statuses.some((s) => s === "failure")) return "failure";
  if (statuses.some((s) => s === "in_progress")) return "in_progress";
  if (statuses.some((s) => s === "action_required")) return "action_required";
  if (statuses.some((s) => s === "pending")) return "pending";
  if (statuses.every((s) => s === "successful")) return "successful";
  if (statuses.every((s) => s === "cancelled")) return "cancelled";
  if (statuses.every((s) => s === "skipped")) return "skipped";
  return "pending";
}

export function WorkflowRunStatusBadge({
  statuses,
}: {
  statuses: string[];
}) {
  const summary = summarizeStatuses(statuses);
  return <JobStatusBadge status={summary} />;
}
