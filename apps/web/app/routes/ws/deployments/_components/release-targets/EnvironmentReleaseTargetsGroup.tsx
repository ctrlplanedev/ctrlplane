import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight } from "lucide-react";

import type { JobStatusDisplayName } from "../../../_components/JobStatusBadge";
import { Button } from "~/components/ui/button";
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
import { ResourceIcon } from "~/components/ui/resource-icon";
import { TableCell, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { JobStatusBadge } from "../../../_components/JobStatusBadge";
import { RedeployDialog } from "../RedeployDialog";
import { RedeployAllDialog } from "./RedeployAllDialog";
import { VersionDisplay } from "./VersionDisplay";

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
type ReleaseTargetState = WorkspaceEngine["schemas"]["ReleaseTargetState"];
type Resource = WorkspaceEngine["schemas"]["Resource"];

type Environment = WorkspaceEngine["schemas"]["Environment"];
type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTarget[];
  environment: Environment;
};

type ReleaseTargetRowProps = {
  releaseTarget: {
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  };
  state: ReleaseTargetState;
  resource: Resource;
};

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

  const failureThreshold = metric.failureThreshold;
  const successThreshold = metric.successThreshold;

  const isComplete = totalMeasurements >= expectedCount;
  const hasFailed = failedCount > failureThreshold;

  let statusMessage: string;
  if (hasFailed) {
    statusMessage = `Failed: ${failedCount} failure${failedCount !== 1 ? "s" : ""} exceeded threshold of ${failureThreshold}`;
  } else if (
    successThreshold != null &&
    passedCount >= successThreshold &&
    isComplete
  ) {
    statusMessage = `Passed: Reached ${successThreshold} consecutive successes`;
  } else if (isComplete && failedCount === 0) {
    statusMessage = `Passed: All ${totalMeasurements} measurements successful`;
  } else if (isComplete) {
    statusMessage = `Passed: ${passedCount} of ${totalMeasurements} passed (within failure threshold)`;
  } else {
    statusMessage = `In progress: ${totalMeasurements} of ${expectedCount} measurements completed`;
  }

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
  const passed = latestMeasurement?.status === "passed";
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
          <span
            className={cn(
              "text-xs",
              passed ? "text-green-500" : "text-red-500 dark:text-red-400",
            )}
          >
            {passed ? "Passed" : "Failed"}{" "}
            {latestMeasurement?.measuredAt != null &&
              `${formatDistanceToNowStrict(new Date(latestMeasurement.measuredAt), { addSuffix: true })}`}
          </span>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2 pl-6 text-xs">
        <MetricSummaryDisplay metric={metric} />
        {sortedMeasurements.map((measurement, idx) => (
          <Measurement key={idx} measurement={measurement} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

type MetricSummary = {
  name: string;
  status: "passing" | "failing" | "inconclusive";
};
const metricStatus = (metric: VerificationMetricStatus): MetricSummary => {
  // If no measurements, treat as inconclusive
  if (metric.measurements.length === 0) {
    return { name: metric.name, status: "inconclusive" };
  }

  // failureLimit: threshold for failure
  const failureLimit = metric.failureThreshold;
  const successThreshold = metric.successThreshold;

  let failedCount = 0;
  let consecutiveSuccessCount = 0;
  let hasPassed = false;
  let hasFailed = false;

  // Traverse measurements in order, just like Go logic
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
        // treat inconclusive as a break in consecutive success
        consecutiveSuccessCount = 0;
        break;
    }
    // If, at this point, we have exceeded the failureLimit: it's failing
    if (failedCount > failureLimit) {
      hasFailed = true;
      break;
    }
    // If at this point, we satisfy the consecutive success threshold, pass
    if (
      typeof successThreshold === "number" &&
      consecutiveSuccessCount >= successThreshold
    ) {
      hasPassed = true;
      // (Go continues to next metric, but for this summary, we can stop)
      break;
    }
  }

  if (hasFailed) return { name: metric.name, status: "failing" };
  if (hasPassed) return { name: metric.name, status: "passing" };

  // If not failed or passed (may still be in progress), mark inconclusive
  if (metric.measurements.length < metric.count)
    return { name: metric.name, status: "inconclusive" };

  // If reached here, all measurements done, not failed or passed threshold,
  // treat as passing if all are passed, otherwise failing (fallback logic).
  const allPassed = metric.measurements.every((m) => m.status === "passed");
  if (allPassed) {
    return { name: metric.name, status: "passing" };
  }
  return { name: metric.name, status: "failing" };
};

function verificationSummary(verification: JobVerification): MetricSummary[] {
  return verification.metrics.map(metricStatus);
}

type OverallVerificationStatus = "passing" | "failing" | "in_progress" | "none";

function getOverallVerificationStatus(
  summaries: MetricSummary[],
): OverallVerificationStatus {
  if (summaries.length === 0) return "none";
  if (summaries.some((s) => s.status === "failing")) return "failing";
  if (summaries.some((s) => s.status === "inconclusive")) return "in_progress";
  return "passing";
}

const VerificationStatusConfig: Record<
  Exclude<OverallVerificationStatus, "none">,
  { label: string; className: string }
> = {
  passing: {
    label: "Verified",
    className:
      "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  },
  failing: {
    label: "Verification Failed",
    className:
      "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  },
  in_progress: {
    label: "Verifying",
    className:
      "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  },
};

function VerificationStatusBadge({
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
              <div className="text-sm font-medium">{verification.message}</div>
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

function ReleaseTargetRow({
  releaseTarget,
  state,
  resource,
}: ReleaseTargetRowProps) {
  const verifications = state.latestJob?.verifications ?? [];
  const summaries = verifications.map(verificationSummary).flat();

  return (
    <TableRow key={releaseTarget.resourceId}>
      <TableCell>
        <div className="flex items-center gap-2">
          <ResourceIcon kind={resource.kind} version={resource.version} />
          {resource.name}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <JobStatusBadge
            message={state.latestJob?.job.message}
            status={
              (state.latestJob?.job.status ??
                "unknown") as keyof typeof JobStatusDisplayName
            }
          />
          <VerificationStatusBadge
            summaries={summaries}
            verifications={verifications}
          />
        </div>
      </TableCell>
      <VersionDisplay {...state} />
      <TableCell className="text-right">
        <RedeployDialog releaseTarget={releaseTarget} />
      </TableCell>
    </TableRow>
  );
}

export function EnvironmentReleaseTargetsGroup({
  releaseTargets,
  environment,
}: EnvironmentReleaseTargetsGroupProps) {
  const [open, setOpen] = useState(true);
  const rts = open ? releaseTargets : [];

  return (
    <Fragment key={environment.id}>
      <TableRow key={environment.id}>
        <TableCell colSpan={4} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5 shrink-0"
            >
              <ChevronRight
                className={cn("s-4 transition-transform", open && "rotate-90")}
              />
            </Button>
            <div className="grow">{environment.name} </div>
            <RedeployAllDialog releaseTargets={rts} />
          </div>
        </TableCell>
      </TableRow>
      {rts.map(({ releaseTarget, state, resource }) => (
        <ReleaseTargetRow
          key={releaseTarget.resourceId}
          releaseTarget={releaseTarget}
          state={state}
          resource={resource}
        />
      ))}
    </Fragment>
  );
}
