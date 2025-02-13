import { useInView } from "react-intersection-observer";

import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";

export const HistorySkeleton: React.FC = () => (
  <div className="flex h-[30px] items-center gap-1">
    {Array.from({ length: 30 }).map((_, i) => (
      <Skeleton
        key={i}
        className="h-full w-1.5 rounded-sm"
        style={{ opacity: 1 * (1 - i / 30) }}
      />
    ))}
  </div>
);

type DeploymentHistoryGraphProps = {
  deploymentId: string;
  resourceId?: string;
};

const DeploymentHistoryGraph: React.FC<DeploymentHistoryGraphProps> = ({
  deploymentId,
  resourceId,
}) => {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const { data, isLoading } = api.deployment.stats.history.useQuery({
    deploymentId,
    timeZone,
    resourceId,
  });

  if (isLoading) return <HistorySkeleton />;

  return (
    <div className="flex h-[30px] items-center gap-1">
      {data?.map(({ successRate }, j) => (
        <div
          key={j}
          className="relative h-full w-1.5 overflow-hidden rounded-sm"
        >
          {successRate == null ? (
            <div className="absolute bottom-0 h-full w-full bg-neutral-700" />
          ) : (
            <>
              <div className="absolute bottom-0 h-full w-full bg-red-500" />
              <div
                className="absolute bottom-0 w-full bg-green-500"
                style={{ height: `${successRate}%` }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export const LazyDeploymentHistoryGraph: React.FC<
  DeploymentHistoryGraphProps
> = (props) => {
  const { ref, inView } = useInView();
  return (
    <div ref={ref}>
      {!inView && <HistorySkeleton />}
      {inView && <DeploymentHistoryGraph {...props} />}
    </div>
  );
};
