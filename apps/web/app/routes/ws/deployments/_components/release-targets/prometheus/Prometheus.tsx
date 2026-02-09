import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "~/lib/utils";
import {
  parsePrometheusMeasurement,
  parsePrometheusProvider,
} from "./prometheus-metric";

type VerificationMetricStatus =
  WorkspaceEngine["schemas"]["VerificationMetricStatus"];
type MetricMeasurement = VerificationMetricStatus["measurements"][number];

export function PrometheusVerificationDisplay({
  metric,
}: {
  metric: VerificationMetricStatus;
}) {
  const provider = parsePrometheusProvider(metric.provider);
  const sortedMeasurements = [...metric.measurements].sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );

  return (
    <div className="space-y-3 pl-1 pr-2">
      <ProviderInfo
        query={provider?.query}
        address={provider?.address}
        successCondition={metric.successCondition}
      />
      {sortedMeasurements.length > 0 && (
        <MeasurementTrend measurements={sortedMeasurements} />
      )}
    </div>
  );
}

function ProviderInfo({
  query,
  address,
  successCondition,
}: {
  query?: string;
  address?: string;
  successCondition: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      {query != null && (
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Query</span>
          <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono">
            {query}
          </code>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <span className="shrink-0 text-muted-foreground">Condition</span>
        <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono">
          {successCondition}
        </code>
      </div>
      {address != null && (
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Server</span>
          <span className="truncate text-muted-foreground">{address}</span>
        </div>
      )}
    </div>
  );
}

function MeasurementTrend({
  measurements,
}: {
  measurements: MetricMeasurement[];
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">Measurements</span>
      <div className="flex flex-col gap-0.5">
        {measurements.map((m, i) => (
          <MeasurementRow key={i} measurement={m} />
        ))}
      </div>
    </div>
  );
}

function MeasurementRow({ measurement }: { measurement: MetricMeasurement }) {
  const parsed = parsePrometheusMeasurement(measurement.data);
  const isPassed = measurement.status === "passed";
  const isFailed = measurement.status === "failed";

  const timeAgo = formatDistanceToNowStrict(
    new Date(measurement.measuredAt),
    { addSuffix: true },
  );

  return (
    <div className="flex items-center justify-between rounded px-1 py-0.5 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            isPassed && "bg-green-500",
            isFailed && "bg-red-500",
            !isPassed && !isFailed && "bg-muted-foreground",
          )}
        />
        <span className="text-muted-foreground">{timeAgo}</span>
      </div>
      <span className="font-mono">
        {parsed?.value != null ? parsed.value : "—"}
      </span>
    </div>
  );
}
