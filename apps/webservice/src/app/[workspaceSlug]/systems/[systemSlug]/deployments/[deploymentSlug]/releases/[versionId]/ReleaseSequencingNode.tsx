import type { NodeProps } from "reactflow";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type ReleaseSequencingNodeProps = NodeProps<{
  policyType?: "cancel" | "wait";
  releaseId: string;
  deploymentId: string;
  environmentId: string;
}>;

const Passing: React.FC = () => (
  <div className="rounded-full bg-green-400 p-0.5 dark:text-black">
    <IconCheck strokeWidth={3} className="h-3 w-3" />
  </div>
);

const Waiting: React.FC = () => (
  <div className="animate-spin rounded-full bg-blue-400 p-0.5 dark:text-black">
    <IconLoader2 strokeWidth={3} className="h-3 w-3" />
  </div>
);

const Loading: React.FC = () => (
  <div className="animate-spin rounded-full bg-muted-foreground p-0.5 dark:text-black">
    <IconLoader2 strokeWidth={3} className="h-3 w-3" />
  </div>
);

const WaitingOnActiveCheck: React.FC<ReleaseSequencingNodeProps["data"]> = ({
  releaseId,
  environmentId,
}) => {
  const allJobs = api.job.config.byReleaseId.useQuery(
    { releaseId },
    { refetchInterval: 10_000 },
  );

  const isReleasePending = allJobs.data?.some(
    (j) =>
      j.job.status === JobStatus.Pending &&
      j.release.id === releaseId &&
      j.environmentId === environmentId,
  );
  const isWaitingOnActive =
    isReleasePending &&
    allJobs.data?.some(
      (j) =>
        j.job.status === JobStatus.InProgress &&
        j.release.id !== releaseId &&
        j.environmentId === environmentId,
    );

  return (
    <div className="flex items-center gap-2">
      {allJobs.isLoading && <Loading />}
      {isWaitingOnActive && (
        <>
          <Waiting /> Another release is in progress
        </>
      )}
      {!isWaitingOnActive && !allJobs.isLoading && (
        <>
          <Passing /> All other releases finished
        </>
      )}
    </div>
  );
};

export const ReleaseSequencingNode: React.FC<ReleaseSequencingNodeProps> = ({
  data,
}) => {
  return (
    <>
      <div
        className={cn(
          "relative w-[250px] space-y-1 rounded-md border px-2 py-1.5 text-sm",
        )}
      >
        <WaitingOnActiveCheck {...data} />
      </div>
      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Right}
      />
    </>
  );
};
