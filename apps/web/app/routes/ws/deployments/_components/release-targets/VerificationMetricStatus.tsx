import { Skeleton } from "~/components/ui/skeleton";
import { safeFormatDistanceToNowStrict } from "~/lib/date";
import { cn } from "~/lib/utils";

import { useMetricMeasurements } from "./useMetricMeasurements";

type MetricMeasurement = {
  status: "failed" | "inconclusive" | "passed";
  data: unknown;
  measuredAt: Date | string;
  message?: string;
};

type VerificationMetricStatusType = {
  id: string;
  name: string;
  count: number;
  successCondition: string;
  successThreshold: number;
  failureCondition?: string;
  failureThreshold: number;
};

type VerificationStatus = "passed" | "failed" | "in_progress";

type MeasurementCounts = {
  failedCount: number;
  consecutiveSuccessCount: number;
};

export function calculateMeasurementCounts(
  measurements: MetricMeasurement[],
): MeasurementCounts {
  let failedCount = 0;
  let consecutiveSuccessCount = 0;

  for (const m of measurements) {
    switch (m.status) {
      case "failed":
        failedCount++;
        consecutiveSuccessCount = 0;
        break;
      case "passed":
        consecutiveSuccessCount++;
        break;
      case "inconclusive":
      default:
        consecutiveSuccessCount = 0;
        break;
    }
  }

  return { failedCount, consecutiveSuccessCount };
}

export function getVerificationStatus(
  metric: VerificationMetricStatusType,
  measurements: MetricMeasurement[],
): {
  status: VerificationStatus;
  message: string;
} {
  if (measurements.length === 0)
    return {
      status: "in_progress",
      message: "Waiting for measurements",
    };

  const failureLimit = metric.failureThreshold;
  const successThreshold = metric.successThreshold;

  const { failedCount, consecutiveSuccessCount } = calculateMeasurementCounts(
    measurements,
  );

  if (failedCount > failureLimit)
    return {
      status: "failed",
      message: `${failedCount} failure${failedCount !== 1 ? "s" : ""} exceeded limit of ${failureLimit}`,
    };

  if (successThreshold != null && consecutiveSuccessCount >= successThreshold)
    return {
      status: "passed",
      message: `${consecutiveSuccessCount} consecutive successes met threshold of ${successThreshold}`,
    };

  if (measurements.length < metric.count)
    return {
      status: "in_progress",
      message: `${measurements.length}/${metric.count} measurements completed`,
    };

  return {
    status: "passed",
    message: `Completed ${measurements.length} measurements within failure limit`,
  };
}

const VerificationStatusColors: Record<VerificationStatus, string> = {
  passed: "text-green-500",
  failed: "text-red-500",
  in_progress: "text-blue-500",
};

const VerificationStatusLabels: Record<VerificationStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  in_progress: "In Progress",
};

export function VerificationMetricStatus({
  metric,
}: {
  metric: VerificationMetricStatusType;
}) {
  const { measurements, isLoading } = useMetricMeasurements(metric.id);

  if (isLoading)
    return <Skeleton className="h-4 w-20" />;

  const { status, message } = getVerificationStatus(metric, measurements);
  const latestMeasurement = [...measurements].sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  )[0];

  const timeAgo = latestMeasurement
    ? safeFormatDistanceToNowStrict(latestMeasurement.measuredAt, {
        addSuffix: true,
      })
    : null;

  return (
    <div className="flex flex-col items-end text-right">
      <span
        className={cn("text-xs font-medium", VerificationStatusColors[status])}
      >
        {VerificationStatusLabels[status]} {timeAgo}
      </span>
      {status === "in_progress" && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
