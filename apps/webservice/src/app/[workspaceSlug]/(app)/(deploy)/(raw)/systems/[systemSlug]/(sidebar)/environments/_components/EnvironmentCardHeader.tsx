import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconDots } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { useEnvironmentHealth } from "../_hooks/useEnvironmentHealth";
import { EnvironmentDropdown } from "./EnvironmentDropdown";
import {
  getHealthStatus,
  getStatusBackgroundColor,
  getStatusTextColor,
} from "./health-status";

export const EnvironmentCardHeader: React.FC<{
  environment: SCHEMA.Environment;
}> = ({ environment }) => {
  const { inView, ref } = useInView();

  const { isHealthSummaryLoading, unhealthyCount, totalCount } =
    useEnvironmentHealth(environment, inView);

  const healthStatus = getHealthStatus(unhealthyCount, totalCount);

  return (
    <CardHeader
      className="flex flex-row items-center justify-between pb-2"
      ref={ref}
    >
      <div className="flex items-center space-x-2">
        {!isHealthSummaryLoading && (
          <div
            className={cn(
              "h-3 w-3 animate-pulse rounded-full",
              getStatusBackgroundColor(healthStatus),
            )}
          />
        )}
        {isHealthSummaryLoading && (
          <div className="h-3 w-3 animate-pulse rounded-full bg-neutral-400" />
        )}
        <CardTitle className="text-sm font-medium">
          {environment.name}
        </CardTitle>
      </div>
      <div className="flex items-center">
        {!isHealthSummaryLoading && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              getStatusBackgroundColor(healthStatus),
              getStatusTextColor(healthStatus),
            )}
          >
            {healthStatus}
          </span>
        )}
        {isHealthSummaryLoading && (
          <Skeleton className="h-6 w-16 rounded-full" />
        )}
        <div className="ml-2">
          <EnvironmentDropdown environment={environment}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <IconDots className="h-4 w-4" />
            </Button>
          </EnvironmentDropdown>
        </div>
      </div>
    </CardHeader>
  );
};
