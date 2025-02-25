import type { JobStatusType } from "@ctrlplane/validators/jobs";
import {
  IconAlertCircle,
  IconCalendarTime,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconExclamationMark,
  IconLoader2,
  IconSettingsX,
} from "@tabler/icons-react";

import { JobStatus } from "@ctrlplane/validators/jobs";

export const StatusIcon: React.FC<{
  statuses: JobStatusType[];
}> = ({ statuses }) => {
  const inProgress = statuses.some((s) => s === JobStatus.InProgress);
  if (inProgress)
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <IconLoader2 strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const hasAnyFailed = statuses.some((s) => s === JobStatus.Failure);
  if (hasAnyFailed)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconExclamationMark strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  if (statuses.some((s) => s === JobStatus.InvalidJobAgent))
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconSettingsX strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  if (statuses.some((s) => s === JobStatus.ActionRequired))
    return (
      <div className="rounded-full bg-yellow-400 p-1 dark:text-black">
        <IconAlertCircle strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const allPending = statuses.every((s) => s === JobStatus.Pending);
  if (allPending)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconClock strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isComplete = statuses.every((s) => s === JobStatus.Successful);
  if (isComplete)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCircleCheck strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isRollingOut = statuses.some((s) => s === JobStatus.Successful);
  if (isRollingOut)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCalendarTime strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  const isCancelled = statuses.some((s) => s === JobStatus.Cancelled);
  if (isCancelled)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconCircleX strokeWidth={2} className="h-4 w-4" />
      </div>
    );

  return (
    <div className="rounded-full bg-green-400 p-1 dark:text-black">
      <IconCircleCheck strokeWidth={2} className="h-4 w-4" />
    </div>
  );
};
