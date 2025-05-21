import type * as SCHEMA from "@ctrlplane/db/schema";
import { useMemo } from "react";
import { subWeeks } from "date-fns";

import { api } from "~/trpc/react";

export const useFailureRate = (
  environment: SCHEMA.Environment,
  enabled: boolean,
) => {
  const endDate = useMemo(() => new Date(), []);
  const startDate = subWeeks(endDate, 1);
  const failureRateQ = api.environment.stats.failureRate.useQuery(
    { environmentId: environment.id, startDate, endDate },
    { enabled },
  );
  return {
    isFailureRateLoading: failureRateQ.isLoading,
    failureRate: failureRateQ.data ?? 0,
  };
};
