import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { formatDistanceToNowStrict } from "date-fns";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import {
  parseDatadogMeasurement,
  parseDatadogProvider,
} from "./datadog-metric";

type VerificationMetricStatus =
  WorkspaceEngine["schemas"]["VerificationMetricStatus"];
type MetricMeasurement = VerificationMetricStatus["measurements"][number];

export function DatadogVerificationDisplay({
  metric,
}: {
  metric: VerificationMetricStatus;
}) {
  const provider = parseDatadogProvider(metric.provider);
  const sortedMeasurements = [...metric.measurements].sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );

  return (
    <div className="min-w-0 space-y-3 overflow-hidden pl-1 pr-2">
      <ProviderInfo
        queries={provider?.queries}
        formula={provider?.formula}
        site={provider?.site}
        aggregator={provider?.aggregator}
        successCondition={metric.successCondition}
      />
      {sortedMeasurements.length > 0 && (
        <MeasurementTrend measurements={sortedMeasurements} />
      )}
    </div>
  );
}

function TruncatedCode({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <code className="block min-w-0 overflow-hidden truncate rounded bg-muted px-1.5 py-0.5 font-mono">
          {children}
        </code>
      </TooltipTrigger>
      <TooltipContent className="max-w-md break-all font-mono text-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function ProviderInfo({
  queries,
  formula,
  site,
  aggregator,
  successCondition,
}: {
  queries?: Record<string, string>;
  formula?: string;
  site?: string;
  aggregator?: string;
  successCondition: string;
}) {
  const queryEntries = Object.entries(queries ?? {});

  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs">
      {queryEntries.map(([name, query]) => (
        <div key={name} className="flex min-w-0 justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Query ({name})</span>
          <TruncatedCode>{query}</TruncatedCode>
        </div>
      ))}
      {formula != null && (
        <div className="flex min-w-0 justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Formula</span>
          <TruncatedCode>{formula}</TruncatedCode>
        </div>
      )}
      <div className="flex min-w-0 justify-between gap-4">
        <span className="shrink-0 text-muted-foreground">Condition</span>
        <TruncatedCode>{successCondition}</TruncatedCode>
      </div>
      {aggregator != null && (
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Aggregator</span>
          <span className="text-muted-foreground">{aggregator}</span>
        </div>
      )}
      {site != null && (
        <div className="flex justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">Site</span>
          <span className="text-muted-foreground">{site}</span>
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
  const parsed = parseDatadogMeasurement(measurement.data);
  const isPassed = measurement.status === "passed";
  const isFailed = measurement.status === "failed";

  const timeAgo = formatDistanceToNowStrict(new Date(measurement.measuredAt), {
    addSuffix: true,
  });

  const queryEntries = Object.entries(parsed?.queries ?? {});

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
      <div className="flex items-center gap-3 font-mono">
        {queryEntries.length > 0 ? (
          queryEntries.map(([name, value]) => (
            <span key={name}>
              <span className="text-muted-foreground">{name}:</span>{" "}
              {value != null ? value : "—"}
            </span>
          ))
        ) : (
          <span>—</span>
        )}
      </div>
    </div>
  );
}
