import type {
  EnvironmentCondition,
  JobCondition,
  ReleaseCondition as JobReleaseCondition,
  StatusCondition,
} from "@ctrlplane/validators/jobs";
import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import type { NodeProps } from "reactflow";
import { IconCheck, IconLoader2, IconMinus, IconX } from "@tabler/icons-react";
import _ from "lodash";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  ColumnOperator,
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobFilterType, JobStatus } from "@ctrlplane/validators/jobs";
import { ReleaseFilterType } from "@ctrlplane/validators/releases";

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/release-channel-drawer/useReleaseChannelDrawer";
import { api } from "~/trpc/react";

type ReleaseSequencingNodeProps = NodeProps<{
  workspaceId: string;
  policyType?: "cancel" | "wait";
  releaseId: string;
  releaseVersion: string;
  deploymentId: string;
  environmentId: string;
}>;

const Passing: React.FC = () => (
  <div className="rounded-full bg-green-400 p-0.5 dark:text-black">
    <IconCheck strokeWidth={3} className="h-3 w-3" />
  </div>
);

const Failing: React.FC = () => (
  <div className="rounded-full bg-red-400 p-0.5 dark:text-black">
    <IconX strokeWidth={3} className="h-3 w-3" />
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

const Cancelled: React.FC = () => (
  <div className="rounded-full bg-neutral-400 p-0.5 dark:text-black">
    <IconMinus strokeWidth={3} className="h-3 w-3" />
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

  const isSameRelease: JobReleaseCondition = {
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
    { refetchInterval: 5_000 },
  );

  const inProgressJobsQ = api.job.config.byWorkspaceId.list.useQuery(
    {
      workspaceId,
      filter: inProgressJobsForDifferentReleaseAndCurrentEnvFilter,
      limit: 1,
    },
    { refetchInterval: 5_000 },
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

const ReleaseChannelCheck: React.FC<ReleaseSequencingNodeProps["data"]> = ({
  deploymentId,
  environmentId,
  releaseVersion,
}) => {
  const { setReleaseChannelId } = useReleaseChannelDrawer();
  const environment = api.environment.byId.useQuery(environmentId);

  const envReleaseChannel = environment.data?.releaseChannels.find(
    (rc) => rc.deploymentId === deploymentId,
  );

  const policyReleaseChannel = environment.data?.policy?.releaseChannels.find(
    (prc) => prc.deploymentId === deploymentId,
  );

  const rcId = envReleaseChannel?.id ?? policyReleaseChannel?.id ?? null;

  const { filter } = envReleaseChannel ??
    policyReleaseChannel ?? { filter: null };

  const versionFilter: ReleaseCondition = {
    type: ReleaseFilterType.Version,
    operator: ColumnOperator.Equals,
    value: releaseVersion,
  };

  const releaseFilter: ReleaseCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: _.compact([versionFilter, filter]),
  };

  const releasesQ = api.release.list.useQuery(
    { deploymentId, filter: releaseFilter, limit: 0 },
    { enabled: filter != null },
  );

  const hasReleaseChannel = rcId != null;
  const isPassingReleaseChannel =
    filter == null ||
    (releasesQ.data?.total != null && releasesQ.data.total > 0);

  const loading = environment.isLoading || releasesQ.isLoading;

  return (
    <div className="flex items-center gap-2">
      {loading && <Loading />}
      {!loading && !hasReleaseChannel && (
        <>
          <Cancelled /> No release channel
        </>
      )}
      {!loading && hasReleaseChannel && !isPassingReleaseChannel && (
        <>
          <Failing />
          <span className="flex items-center gap-1">
            Blocked by{" "}
            <Button
              variant="link"
              onClick={() => setReleaseChannelId(rcId)}
              className="h-fit px-0 py-0 text-inherit underline-offset-2"
            >
              release channel
            </Button>
          </span>
        </>
      )}
      {!loading && hasReleaseChannel && isPassingReleaseChannel && (
        <>
          <Passing />
          <span className="flex items-center gap-1">
            Passing{" "}
            <Button
              variant="link"
              onClick={() => setReleaseChannelId(rcId)}
              className="h-fit px-0 py-0 text-inherit underline-offset-2"
            >
              release channel
            </Button>
          </span>
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
        <ReleaseChannelCheck {...data} />
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