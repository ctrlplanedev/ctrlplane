import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
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
import { TableCell } from "~/components/ui/table";
import { cn } from "~/lib/utils";

type Release = WorkspaceEngine["schemas"]["Release"];
type Job = WorkspaceEngine["schemas"]["Job"];
type ReleaseVerification = WorkspaceEngine["schemas"]["ReleaseVerification"];
type VerificationMetric = ReleaseVerification["metrics"][number];
type MetricMeasurement = VerificationMetric["measurements"][number];

function Measurement({ measurement }: { measurement: MetricMeasurement }) {
  return (
    <div className="space-y-1">
      <span
        className={cn(
          "text-xs",
          measurement.passed ? "text-green-500" : "text-red-500",
        )}
      >
        {measurement.passed ? "Passed" : "Failed"}
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

function Metric({ metric }: { metric: VerificationMetric }) {
  const [open, setOpen] = useState(false);
  const sortedMeasurements = metric.measurements.sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );
  const latestMeasurement = sortedMeasurements.at(0);
  const passed = latestMeasurement?.passed ?? true;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-1.5 rounded-md p-1.5 hover:bg-muted">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              open ? "rotate-90" : "",
            )}
          />
          <span className="text-sm font-medium">{metric.name}</span>
          <div className="flex-grow" />
          <span
            className={cn(
              "text-xs",
              passed ? "text-green-500" : "text-red-500",
            )}
          >
            {passed ? "Passed" : "Failed"}{" "}
            {latestMeasurement?.measuredAt != null &&
              `${formatDistanceToNowStrict(new Date(latestMeasurement.measuredAt), { addSuffix: true })}`}
          </span>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-1.5">
        {sortedMeasurements.map((measurement, idx) => (
          <Measurement key={idx} measurement={measurement} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReleaseVersionTag({
  tag,
  verification,
}: {
  tag: string;
  verification?: ReleaseVerification;
}) {
  if (verification == null) return tag;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <span className="underline-offset-1.5 cursor-pointer truncate font-mono hover:underline">
          {tag}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Verifications</DialogTitle>
        </DialogHeader>

        {verification.metrics.map((metric) => (
          <Metric key={metric.name} metric={metric} />
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function VersionDisplay({
  desiredRelease,
  currentRelease,
  latestJob,
}: {
  desiredRelease?: Release;
  currentRelease?: Release;
  latestJob?: Job;
}) {
  console.log({
    desiredRelease,
    currentRelease,
    latestJob,
  });
  const fromVersion = currentRelease?.version.tag ?? "Not yet deployed";
  const toVersion = desiredRelease?.version.tag ?? "unknown";
  const isInSync = fromVersion === toVersion;
  const isProgressing =
    latestJob?.status === "inProgress" || latestJob?.status === "pending";
  const isUnhealthy =
    latestJob?.status === "failure" ||
    latestJob?.status === "invalidJobAgent" ||
    latestJob?.status === "invalidIntegration" ||
    latestJob?.status === "externalRunNotFound";

  return (
    <TableCell
      className={cn(
        "font-mono text-sm",
        isInSync
          ? "text-green-500"
          : isProgressing
            ? "text-blue-500"
            : isUnhealthy
              ? "text-red-500"
              : "text-neutral-500",
      )}
    >
      <ReleaseVersionTag
        tag={isInSync ? toVersion : `${fromVersion} → ${toVersion}`}
        verification={desiredRelease?.verification}
      />
    </TableCell>
  );
}
