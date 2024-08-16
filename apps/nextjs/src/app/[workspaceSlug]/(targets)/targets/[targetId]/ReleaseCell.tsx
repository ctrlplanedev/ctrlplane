"use client";

import type {
  Deployment,
  JobConfig,
  JobExecution,
  Release,
} from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { TbCircleCheck, TbLoader2 } from "react-icons/tb";

const ReleaseIcon: React.FC<{
  jobExec?: JobExecution;
}> = ({ jobExec }) => {
  if (jobExec?.status === "pending" || jobExec?.status === "in_progress")
    return (
      <div className="animate-spin rounded-full bg-blue-400 p-1 dark:text-black">
        <TbLoader2 strokeWidth={2} />
      </div>
    );

  if (jobExec?.status === "completed")
    return (
      <div className="rounded-full bg-green-400 p-1 dark:text-black">
        <TbCircleCheck strokeWidth={2} />
      </div>
    );

  return null;
};

export const ReleaseCell: React.FC<{
  deployment: Deployment;
  jobConfig: JobConfig & {
    release?: Partial<Release>;
    execution?: JobExecution;
  };
}> = ({ deployment, jobConfig }) => {
  const params = useParams<{ workspaceSlug: string; systemSlug: string }>();
  return (
    <Link
      href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${deployment.slug}/releases/${jobConfig.releaseId}`}
      className="flex items-center gap-2"
    >
      <ReleaseIcon jobExec={jobConfig.execution} />
      <div className="w-full text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{jobConfig.release?.version}</span>
        </div>
        <div className="text-left text-muted-foreground">
          {format(jobConfig.createdAt, "MMM d, hh:mm aa")}
        </div>
      </div>
    </Link>
  );
};
