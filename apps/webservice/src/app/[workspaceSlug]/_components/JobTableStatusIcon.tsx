import type * as schema from "@ctrlplane/db/schema";
import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const JobTableStatusIcon: React.FC<{
  status?: schema.JobStatus;
  className?: string;
}> = ({ status, className }) => {
  if (status === JobStatus.Completed)
    return (
      <IconCircleCheck className={cn("h-4 w-4 text-green-400", className)} />
    );
  if (status === JobStatus.Failure || status === JobStatus.InvalidJobAgent)
    return <IconCircleX className={cn("h-4 w-4 text-red-400", className)} />;
  if (status === JobStatus.Pending)
    return <IconClock className={cn("h-4 w-4 text-neutral-400", className)} />;
  if (status === JobStatus.InProgress)
    return (
      <div className="animate-spin rounded-full text-blue-400">
        <IconLoader2 className={cn("h-4 w-4", className)} />
      </div>
    );
  if (status === JobStatus.Cancelled)
    return (
      <IconCircleX className={cn("h-4 w-4 text-neutral-400", className)} />
    );

  return <IconClock className={cn("h-4 w-4 text-neutral-400", className)} />;
};
