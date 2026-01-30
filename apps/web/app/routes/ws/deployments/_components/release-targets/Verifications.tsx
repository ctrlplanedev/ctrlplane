import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Fragment, useState } from "react";
import { capitalCase } from "change-case";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { ArgoCDVerificationDisplay } from "./argocd/ArgoCD";
import { isArgoCDMeasurement } from "./argocd/argocd-metric";
import { VerificationMetricStatus } from "./VerificationMetricStatus";

type JobVerification = WorkspaceEngine["schemas"]["JobVerification"];
type VerificationMetricStatus =
  WorkspaceEngine["schemas"]["VerificationMetricStatus"];
type MetricMeasurement = VerificationMetricStatus["measurements"][number];

function Measurement({ measurement }: { measurement: MetricMeasurement }) {
  return (
    <div className="space-y-1">
      <span
        className={cn(
          "text-xs",
          measurement.status === "passed"
            ? "text-green-500"
            : measurement.status === "failed"
              ? "text-red-500 "
              : "text-muted-foreground",
        )}
      >
        {measurement.status === "passed"
          ? "Passed"
          : measurement.status === "failed"
            ? "Failed"
            : "Inconclusive"}
      </span>
      {measurement.data != null && (
        <div className="max-h-60 overflow-y-auto rounded-md border p-2">
          <pre className="whitespace-pre-wrap text-xs">
            {JSON.stringify(measurement.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function getConsecutiveSuccessCount(measurements: MetricMeasurement[]): number {
  let consecutiveSuccessCount = 0;
  for (const m of measurements) {
    if (m.status === "passed") consecutiveSuccessCount++;
    else consecutiveSuccessCount = 0;
  }

  return consecutiveSuccessCount;
}

function getStatusMessage(
  failedCount: number,
  failureLimit: number,
  consecutiveSuccessCount: number,
  successThreshold: number | undefined,
  totalMeasurements: number,
  expectedCount: number,
): string {
  const hasFailed = failedCount > failureLimit;
  if (hasFailed)
    return `Failed: ${failedCount} failure${failedCount !== 1 ? "s" : ""} exceeded limit of ${failureLimit}`;

  const hasPassedThreshold =
    successThreshold != null && consecutiveSuccessCount >= successThreshold;
  if (hasPassedThreshold)
    return `Passed: ${consecutiveSuccessCount} consecutive successes met threshold of ${successThreshold}`;

  const isComplete = totalMeasurements >= expectedCount;
  if (!isComplete)
    return `In progress: ${totalMeasurements} of ${expectedCount} measurements completed`;

  return `Passed: Completed ${totalMeasurements} measurements within failure limit`;
}

function MetricSummaryDisplay({
  metric,
}: {
  metric: VerificationMetricStatus;
}) {
  const passedCount = metric.measurements.filter(
    (m) => m.status === "passed",
  ).length;
  const failedCount = metric.measurements.filter(
    (m) => m.status === "failed",
  ).length;
  const totalMeasurements = metric.measurements.length;
  const expectedCount = metric.count;

  const failureLimit = metric.failureThreshold ?? 0;
  const successThreshold = metric.successThreshold;

  const consecutiveSuccessCount = getConsecutiveSuccessCount(
    metric.measurements,
  );

  const statusMessage = getStatusMessage(
    failedCount,
    failureLimit,
    consecutiveSuccessCount,
    successThreshold,
    totalMeasurements,
    expectedCount,
  );

  return (
    <div className="space-y-1 rounded-md border border-muted bg-muted/30 p-2">
      <div className="flex items-center gap-4">
        <span>
          <span className="text-muted-foreground">Progress:</span>{" "}
          {totalMeasurements}/{expectedCount}
        </span>
        <span>
          <span className="text-green-600 dark:text-green-400">
            ✓ {passedCount}
          </span>
          {" / "}
          <span className="text-red-600 dark:text-red-400">
            ✗ {failedCount}
          </span>
        </span>
      </div>
      <div className="text-muted-foreground">{statusMessage}</div>
    </div>
  );
}

function MetricDisplay({ metric }: { metric: VerificationMetricStatus }) {
  const [open, setOpen] = useState(false);
  const sortedMeasurements = [...metric.measurements].sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );
  const latestMeasurement = sortedMeasurements.at(0);

  const isArgoCD =
    latestMeasurement != null && isArgoCDMeasurement(latestMeasurement.data);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer items-center gap-1.5 rounded-md p-1.5 hover:bg-muted">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              open ? "rotate-90" : "",
            )}
          />
          <span className="text-sm font-medium">{metric.name}</span>
          <div className="grow" />
          <VerificationMetricStatus metric={metric} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2 pl-6 text-xs">
        {isArgoCD && <ArgoCDVerificationDisplay metric={metric} />}
        {!isArgoCD && (
          <>
            <MetricSummaryDisplay metric={metric} />
            {sortedMeasurements.map((measurement, idx) => (
              <Measurement key={idx} measurement={measurement} />
            ))}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

type MetricSummary = {
  name: string;
  status: "passed" | "failed" | "inconclusive";
};

type VerificationMetricStatusType =
  WorkspaceEngine["schemas"]["VerificationMetricStatus"];

const metricStatus = (metric: VerificationMetricStatusType): MetricSummary => {
  if (metric.measurements.length === 0) {
    return { name: metric.name, status: "inconclusive" };
  }

  const failureLimit = metric.failureThreshold ?? 0;
  const successThreshold = metric.successThreshold;

  let failedCount = 0;
  let consecutiveSuccessCount = 0;

  // Process ALL measurements first (no early exit)
  for (const m of metric.measurements) {
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

  if (failedCount > failureLimit)
    return { name: metric.name, status: "failed" };

  if (successThreshold != null && consecutiveSuccessCount >= successThreshold)
    return { name: metric.name, status: "passed" };

  if (metric.measurements.length < metric.count)
    return { name: metric.name, status: "inconclusive" };

  return { name: metric.name, status: "passed" };
};

export function verificationSummary(
  verification: JobVerification,
): MetricSummary[] {
  return verification.metrics.map(metricStatus);
}

type OverallVerificationStatus = "passed" | "failed" | "inconclusive" | "none";

function getOverallVerificationStatus(
  summaries: MetricSummary[],
): OverallVerificationStatus {
  if (summaries.length === 0) return "none";
  if (summaries.some((s) => s.status === "failed")) return "failed";
  if (summaries.some((s) => s.status === "inconclusive")) return "inconclusive";
  return "passed";
}

const VerificationStatusConfig: Record<
  Exclude<OverallVerificationStatus, "none">,
  { label: string; className: string }
> = {
  passed: {
    label: "Verified",
    className:
      "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  },
  failed: {
    label: "Verification Failed",
    className:
      "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  },
  inconclusive: {
    label: "Verifying",
    className:
      "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  },
};

export function VerificationStatusBadge({
  summaries,
  verifications,
}: {
  summaries: MetricSummary[];
  verifications?: JobVerification[];
}) {
  const status = getOverallVerificationStatus(summaries);
  if (status === "none" || verifications?.length === 0) return null;

  const config = VerificationStatusConfig[status];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <span
          className={`inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium hover:opacity-80 ${config.className}`}
        >
          {config.label}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Verifications</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {verifications?.map((verification) => (
            <Fragment key={verification.id}>
              <div className="pl-7 text-xs">{verification.message}</div>
              {verification.metrics.map((metric) => (
                <MetricDisplay key={metric.name} metric={metric} />
              ))}
            </Fragment>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
