"use client";

import type {
  Deployment,
  Job,
  Release,
  ReleaseJobTrigger,
} from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";
import { format } from "date-fns";

import { JobStatus } from "@ctrlplane/validators/jobs";

export const ReleaseIcon: React.FC<{
  job?: Job;
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

export const ReleaseCell: React.FC<{
  deployment: Deployment;
  releaseJobTrigger: ReleaseJobTrigger & {
    release?: Partial<Release>;
    job?: Job;
  };
}> = ({ deployment, releaseJobTrigger }) => {
  const params = useParams<{ workspaceSlug: string; systemSlug: string }>();
  return (
    <Link
      href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${deployment.slug}/releases/${releaseJobTrigger.releaseId}`}
      className="flex items-center gap-2"
    >
      <ReleaseIcon job={releaseJobTrigger.job} />
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
