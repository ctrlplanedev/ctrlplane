import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  activeStatus,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

const getStatusInfo = (statuses: (JobStatus | null)[]) => {
  const nonNullStatuses = statuses.filter(isPresent);

  const numFailed = nonNullStatuses.filter((s) =>
    failedStatuses.includes(s),
  ).length;
  const numActive = nonNullStatuses.filter((s) =>
    activeStatus.includes(s),
  ).length;
  const numPending = nonNullStatuses.filter(
    (s) => s === JobStatus.Pending,
  ).length;
  const numSuccessful = nonNullStatuses.filter(
    (s) => s === JobStatus.Successful,
  ).length;

  if (numFailed > 0)
    return {
      numSuccessful,
      Icon: <IconCircleX className="h-4 w-4 text-red-500" />,
    };
  if (numActive > 0)
    return {
      numSuccessful,
      Icon: <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />,
    };
  if (numPending > 0)
    return {
      numSuccessful,
      Icon: <IconClock className="h-4 w-4 text-neutral-400" />,
    };
  return {
    numSuccessful,
    Icon: <IconCircleCheck className="h-4 w-4 text-green-500" />,
  };
};

export const SystemStatus: React.FC<{
  resourceId: string;
  systemId: string;
}> = ({ resourceId, systemId }) => {
  const { data, isLoading } = api.resource.systemOverview.useQuery({
    resourceId,
    systemId,
  });

  if (isLoading) return <Skeleton className="h-4 w-16" />;

  const statuses = (data ?? []).map((d) => d.status);
  const { numSuccessful, Icon } = getStatusInfo(
    statuses as (JobStatus | null)[],
  );

  return (
    <div className="flex items-center gap-2">
      {Icon}
      <span>
        {numSuccessful}/{statuses.length}
      </span>
    </div>
  );
};
