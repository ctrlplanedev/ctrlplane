import type * as schema from "@ctrlplane/db/schema";
import { TbCircleCheck, TbCircleX, TbClock, TbLoader2 } from "react-icons/tb";

import { JobStatus } from "@ctrlplane/validators/jobs";

export const JobTableStatusIcon: React.FC<{ status?: schema.JobStatus }> = ({
  status,
}) => {
  if (status === JobStatus.Completed)
    return <TbCircleCheck className="text-green-400" />;
  if (status === JobStatus.Failure || status === JobStatus.InvalidJobAgent)
    return <TbCircleX className="text-red-400" />;
  if (status === JobStatus.Pending)
    return <TbClock className="text-neutral-400" />;
  if (status === JobStatus.InProgress)
    return (
      <div className="animate-spin rounded-full text-blue-400">
        <TbLoader2 />
      </div>
    );

  return <TbClock className="text-neutral-400" />;
};
