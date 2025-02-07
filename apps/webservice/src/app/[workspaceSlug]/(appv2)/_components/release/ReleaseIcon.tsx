import type * as SCHEMA from "@ctrlplane/db/schema";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";

import { JobStatus } from "@ctrlplane/validators/jobs";

export const ReleaseIcon: React.FC<{
  job?: SCHEMA.Job;
}> = ({ job }) => {
  if (job?.status === JobStatus.Pending)
    return (
      <div className="rounded-full bg-blue-400 p-1 dark:text-black">
        <IconClock strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.InProgress)
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <IconLoader2 strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Successful)
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <IconCircleCheck strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Cancelled)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconCircleX strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Failure)
    return (
      <div className="rounded-full bg-red-400 p-1 dark:text-black">
        <IconCircleX strokeWidth={2} />
      </div>
    );

  if (job?.status === JobStatus.Skipped)
    return (
      <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
        <IconCircleDashed strokeWidth={2} />
      </div>
    );

  if (
    job?.status === JobStatus.InvalidJobAgent ||
    job?.status === JobStatus.InvalidIntegration
  )
    return (
      <div className="rounded-full bg-orange-500 p-1 dark:text-black">
        <IconAlertCircle strokeWidth={2} />
      </div>
    );

  return null;
};
