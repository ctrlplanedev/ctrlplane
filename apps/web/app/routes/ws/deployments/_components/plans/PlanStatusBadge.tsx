import { AlertCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export const PlanStatusDisplayName: Record<string, string> = {
  computing: "Computing",
  completed: "Completed",
  errored: "Errored",
  unsupported: "Unsupported",
};

const PlanStatusBadgeColor: Record<string, string> = {
  computing:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  completed:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  errored:
    "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  unsupported:
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
};

function PlanStatusBadgeInner({
  status,
  hasMessage = false,
}: {
  status: string;
  hasMessage?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${
        PlanStatusBadgeColor[status] ??
        "border-neutral-200 bg-neutral-100 text-neutral-700"
      }`}
    >
      {PlanStatusDisplayName[status] ?? status}
      {hasMessage && <AlertCircle className="size-2.5" />}
    </span>
  );
}

export function PlanStatusBadge({
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
            <PlanStatusBadgeInner status={status} hasMessage />
          </TooltipTrigger>
          <TooltipContent className="wrap-break-word flex max-w-sm items-center gap-1.5">
            {message}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <PlanStatusBadgeInner status={status} />;
}
