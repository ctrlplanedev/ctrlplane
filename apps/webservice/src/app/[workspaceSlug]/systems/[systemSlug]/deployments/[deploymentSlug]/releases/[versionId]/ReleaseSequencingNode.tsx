import type {
  EnvironmentCondition,
  JobCondition,
  ReleaseCondition,
  StatusCondition,
} from "@ctrlplane/validators/jobs";
import type { NodeProps } from "reactflow";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import {
  ColumnOperator,
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobFilterType, JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type ReleaseSequencingNodeProps = NodeProps<{
  workspaceId: string;
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
  workspaceId,
  releaseId,
  environmentId,
}) => {
  const isSameEnvironment: EnvironmentCondition = {
    type: JobFilterType.Environment,
    operator: ColumnOperator.Equals,
    value: environmentId,
  };

  const isPending: StatusCondition = {
    type: JobFilterType.Status,
    operator: ColumnOperator.Equals,
    value: JobStatus.Pending,
  };

  const isInProgress: StatusCondition = {
    type: JobFilterType.Status,
    operator: ColumnOperator.Equals,
    value: JobStatus.InProgress,
  };

  const isSameRelease: ReleaseCondition = {
    type: JobFilterType.Release,
    operator: ColumnOperator.Equals,
    value: releaseId,
  };

  const isDifferentRelease: JobCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    not: true,
    conditions: [isSameRelease],
  };

  const pendingJobsForCurrentReleaseAndEnvFilter: JobCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [isSameEnvironment, isPending, isSameRelease],
  };

  const inProgressJobsForDifferentReleaseAndCurrentEnvFilter: JobCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [isSameEnvironment, isInProgress, isDifferentRelease],
  };

  const pendingJobsQ = api.job.config.byWorkspaceId.list.useQuery(
    {
      workspaceId,
      filter: pendingJobsForCurrentReleaseAndEnvFilter,
      limit: 1,
    },
    { refetchInterval: 2_000 },
  );

  const inProgressJobsQ = api.job.config.byWorkspaceId.list.useQuery(
    {
      workspaceId,
      filter: inProgressJobsForDifferentReleaseAndCurrentEnvFilter,
      limit: 1,
    },
    { refetchInterval: 2_000 },
  );

  const loading = pendingJobsQ.isLoading || inProgressJobsQ.isLoading;

  const isCurrentReleasePending =
    pendingJobsQ.data != null && pendingJobsQ.data.total > 0;
  const isSeparateReleaseInProgress =
    inProgressJobsQ.data != null && inProgressJobsQ.data.total > 0;

  const isWaitingOnActive =
    isCurrentReleasePending && isSeparateReleaseInProgress;

  return (
    <div className="flex items-center gap-2">
      {loading && <Loading />}
      {!loading && isWaitingOnActive && (
        <>
          <Waiting /> Another release is in progress
        </>
      )}
      {!loading && !isWaitingOnActive && (
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
