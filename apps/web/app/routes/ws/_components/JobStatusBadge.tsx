export const JobStatusDisplayName = {
  cancelled: "Cancelled",
  skipped: "Skipped",
  inProgress: "In Progress",
  actionRequired: "Action Required",
  pending: "Pending",
  failure: "Failure",
  invalidJobAgent: "Invalid Job Agent",
  invalidIntegration: "Invalid Integration",
  externalRunNotFound: "External Run Not Found",
  successful: "Successful",
};

// Basic job status badge component with color mapping

const JobStatusBadgeColor: Record<string, string> = {
  cancelled:
    "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800",
  skipped:
    "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800",
  inProgress:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  actionRequired:
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  pending:
    "bg-muted dark:bg-muted-foreground text-muted-foreground dark:text-muted border-muted-foreground/20 dark:border-muted-foreground/20",
  failure:
    "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  invalidJobAgent:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  invalidIntegration:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  externalRunNotFound:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  successful:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
};

export function JobStatusBadge({
  status,
}: {
  status: keyof typeof JobStatusDisplayName;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${JobStatusBadgeColor[status] ?? "border-neutral-200 bg-neutral-100 text-neutral-700"}`}
    >
      {JobStatusDisplayName[status]}
    </span>
  );
}
