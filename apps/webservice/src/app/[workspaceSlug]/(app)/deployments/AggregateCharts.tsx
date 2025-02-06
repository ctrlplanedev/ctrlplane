import type { RouterOutputs } from "@ctrlplane/api";
import _ from "lodash";
import prettyMilliseconds from "pretty-ms";
import { isPresent } from "ts-is-present";

// import prettyMilliseconds from "pretty-ms";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

type AggregateCardProps = {
  title: string;
  value: number | string;
  isLoading: boolean;
};

const AggregateCard: React.FC<AggregateCardProps> = ({
  title,
  value,
  isLoading,
}) => (
  <Card className="grid-cols-1 rounded-md">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading && <Skeleton className="h-7 w-16" />}
      {!isLoading && <p className="text-xl font-semibold">{value}</p>}
    </CardContent>
  </Card>
);

type AggregateChartsProps = {
  data?: RouterOutputs["deployment"]["stats"]["byWorkspaceId"];
  isLoading: boolean;
};

export const AggregateCharts: React.FC<AggregateChartsProps> = ({
  data,
  isLoading,
}) => {
  const totalJobs = data != null ? _.sumBy(data, (d) => d.totalJobs) : 0;

  const totalDuration =
    data != null
      ? _.chain(data)
          .filter((d) => isPresent(d.totalDuration))
          .sumBy((d) => d.totalDuration!)
          .value()
      : 0;
  const totalDurationMs = Math.round(totalDuration * 1000);
  const totalDurationPretty = prettyMilliseconds(totalDurationMs, {
    unitCount: 2,
    secondsDecimalDigits: 0,
  });

  const totalSuccess = data != null ? _.sumBy(data, (d) => d.totalSuccess) : 0;
  const totalSuccessRate = data != null ? (totalSuccess / totalJobs) * 100 : 0;
  const totalSuccessRatePretty = `${totalSuccessRate.toFixed(2)}%`;
  const averageDurationMs =
    data != null ? Math.round(totalDurationMs / totalJobs) : 0;
  const averageDurationPretty = prettyMilliseconds(averageDurationMs, {
    unitCount: 2,
    secondsDecimalDigits: 0,
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      <AggregateCard
        title="Total Jobs"
        value={totalJobs}
        isLoading={isLoading}
      />
      <AggregateCard
        title="Total Duration"
        value={totalDurationPretty}
        isLoading={isLoading}
      />
      <AggregateCard
        title="Success Rate"
        value={totalSuccessRatePretty}
        isLoading={isLoading}
      />
      <AggregateCard
        title="Average Duration"
        value={averageDurationPretty}
        isLoading={isLoading}
      />
    </div>
  );
};
