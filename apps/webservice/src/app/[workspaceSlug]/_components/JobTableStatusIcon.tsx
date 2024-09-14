import type { JobStatus } from "@ctrlplane/db/schema";
import { TbCircleCheck, TbCircleX, TbClock, TbLoader2 } from "react-icons/tb";

export const JobTableStatusIcon: React.FC<{ status?: JobStatus }> = ({
  status,
}) => {
  if (status === "completed")
    return <TbCircleCheck className="text-green-400" />;
  if (status === "failure" || status === "invalid_job_agent")
    return <TbCircleX className="text-red-400" />;
  if (status === "in_progress" || status === "pending")
    return (
      <div className="animate-spin rounded-full text-blue-400">
        <TbLoader2 />
      </div>
    );

  return <TbClock className="text-neutral-400" />;
};
