import { AlertCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export const JobStatusDisplayName: Record<string, string> = {
  cancelled: "Cancelled",
  skipped: "Skipped",
  in_progress: "In Progress",
  action_required: "Action Required",
  pending: "Pending",
  failure: "Failure",
  invalid_job_agent: "Invalid Job Agent",
  invalid_integration: "Invalid Integration",
  external_run_not_found: "External Run Not Found",
  successful: "Successful",
};

// Basic job status badge component with color mapping

const JobStatusBadgeColor: Record<string, string> = {
  cancelled:
    "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800",
  skipped:
    "bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800",
  in_progress:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  action_required:
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  pending:
    "bg-muted dark:bg-muted-foreground text-muted-foreground dark:text-muted border-muted-foreground/20 dark:border-muted-foreground/20",
  failure:
    "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  invalid_job_agent:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  invalid_integration:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  external_run_not_found:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  successful:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
};

function JobStatusBadgeInner({
  status,
  hasMessage = false,
}: {
  status: string;
  hasMessage?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${JobStatusBadgeColor[status] ?? "border-neutral-200 bg-neutral-100 text-neutral-700"}`}
    >
      {JobStatusDisplayName[status] ?? status}
      {hasMessage && <AlertCircle className="size-2.5" />}
    </span>
  );
}

export function JobStatusBadge({
  status,
  message,
}: {
  status: string;
  message?: string | null;
}) {
  if (message != null && message !== "") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <JobStatusBadgeInner status={status} hasMessage />
          </TooltipTrigger>
          <TooltipContent className="wrap-break-word flex max-w-sm items-center gap-1.5">
            {message}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <JobStatusBadgeInner status={status} />;
}
