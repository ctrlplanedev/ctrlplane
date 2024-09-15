"use client";

import type {
  Deployment,
  Job,
  Release,
  ReleaseJobTrigger,
} from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { TbCircleCheck, TbClock, TbLoader2 } from "react-icons/tb";

const ReleaseIcon: React.FC<{
  job?: Job;
}> = ({ job }) => {
  if (job?.status === "triggered")
    return (
      <div className="rounded-full bg-blue-400 p-1 dark:text-black">
        <TbClock strokeWidth={2} />
      </div>
    );

  if (job?.status === "pending" || job?.status === "in_progress")
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <TbLoader2 strokeWidth={2} />
      </div>
    );

  if (job?.status === "completed")
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <TbCircleCheck strokeWidth={2} />
      </div>
    );

  return null;
};

export const ReleaseCell: React.FC<{
  deployment: Deployment;
  releaseJobTrigger: ReleaseJobTrigger & {
    release?: Partial<Release>;
    execution?: Job;
  };
}> = ({ deployment, releaseJobTrigger }) => {
  const params = useParams<{ workspaceSlug: string; systemSlug: string }>();
  return (
    <Link
      href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${deployment.slug}/releases/${releaseJobTrigger.releaseId}`}
      className="flex items-center gap-2"
    >
      <ReleaseIcon job={releaseJobTrigger.execution} />
      <div className="w-full text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {releaseJobTrigger.release?.version}
          </span>
        </div>
        <div className="text-left text-muted-foreground">
          {format(releaseJobTrigger.createdAt, "MMM d, hh:mm aa")}
        </div>
      </div>
    </Link>
  );
};
