import type * as SCHEMA from "@ctrlplane/db/schema";
import { useCallback } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { CardContent } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { toast } from "@ctrlplane/ui/toast";

import { useEnvironmentHealth } from "../_hooks/useEnvironmentHealth";
import { useFailureRate } from "../_hooks/useFailureRate";
import { getHealthStatus, getStatusTextColor } from "./health-status";

export const EnvironmentCardContent: React.FC<{
  environment: SCHEMA.Environment;
}> = ({ environment }) => {
  const { inView, ref } = useInView();

  const { isHealthSummaryLoading, unhealthyCount, totalCount } =
    useEnvironmentHealth(environment, inView);

  const healthStatus = getHealthStatus(unhealthyCount, totalCount);

  const { isFailureRateLoading, failureRate } = useFailureRate(
    environment,
    inView,
  );

  return (
    <CardContent className="mt-4 space-y-3" ref={ref}>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Resources</span>
        {isHealthSummaryLoading && <Skeleton className="h-4 w-16" />}
        {!isHealthSummaryLoading && (
          <span className="text-sm font-medium">
            {totalCount > 0 ? `${totalCount} total` : "None"}
          </span>
        )}
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Health</span>
        {isHealthSummaryLoading && <Skeleton className="h-4 w-20" />}
        {!isHealthSummaryLoading && (
          <span
            className={cn(
              "text-sm font-medium",
              getStatusTextColor(healthStatus),
            )}
          >
            {totalCount > 0
              ? `${totalCount - unhealthyCount}/${totalCount} Healthy`
              : "No resources"}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Environment ID</span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">
            {environment.id.substring(0, 8)}...
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full hover:bg-neutral-800/50"
            onClick={useCallback(
              (e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                navigator.clipboard.writeText(environment.id);
                toast.success("Environment ID copied to clipboard", {
                  description: environment.id,
                  duration: 2000,
                  icon: <IconCheck className="h-4 w-4" />,
                });
              },
              [environment.id],
            )}
            title="Copy environment ID"
          >
            <IconCopy className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Failure Rate</span>
        {inView && !isFailureRateLoading && (
          <span
            className={cn(
              "text-sm font-medium",
              failureRate > 5 ? "text-red-400" : "text-green-400",
            )}
          >
            {Number(failureRate.toFixed(0))}% failure rate
          </span>
        )}
        {(!inView || isFailureRateLoading) && <Skeleton className="h-4 w-28" />}
      </div>
    </CardContent>
  );
};
