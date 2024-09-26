import type * as schema from "@ctrlplane/db/schema";
import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";

import { JobStatus } from "@ctrlplane/validators/jobs";

export const JobTableStatusIcon: React.FC<{ status?: schema.JobStatus }> = ({
  status,
}) => {
  if (status === JobStatus.Completed)
    return <IconCircleCheck className="h-4 w-4 text-green-400" />;
  if (status === JobStatus.Failure || status === JobStatus.InvalidJobAgent)
    return <IconCircleX className="h-4 w-4 text-red-400" />;
  if (status === JobStatus.Pending)
    return <IconClock className="h-4 w-4 text-neutral-400" />;
  if (status === JobStatus.InProgress)
    return (
      <div className="animate-spin rounded-full text-blue-400">
        <IconLoader2 className="h-4 w-4" />
      </div>
    );

  return <IconClock className="h-4 w-4 text-neutral-400" />;
};
