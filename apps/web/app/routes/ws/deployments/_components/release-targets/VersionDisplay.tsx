/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { TableCell } from "~/components/ui/table";
import { cn } from "~/lib/utils";

type Release = WorkspaceEngine["schemas"]["Release"];
type JobWithVerifications = WorkspaceEngine["schemas"]["JobWithVerifications"];

export function VersionDisplay({
  desiredRelease,
  currentRelease,
  latestJob,
}: {
  desiredRelease?: Release;
  currentRelease?: Release;
  latestJob?: JobWithVerifications;
}) {
  const job = latestJob?.job;
  const fromVersion =
    currentRelease?.version.name ||
    currentRelease?.version.tag ||
    "Not yet deployed";
  const toVersion =
    desiredRelease?.version.name || desiredRelease?.version.tag || "unknown";
  const isInSync = fromVersion === toVersion || desiredRelease == null;
  const isProgressing =
    job?.status === "inProgress" || job?.status === "pending";
  const isUnhealthy =
    job?.status === "failure" ||
    job?.status === "invalidJobAgent" ||
    job?.status === "invalidIntegration" ||
    job?.status === "externalRunNotFound";

  const tag = isInSync ? fromVersion : `${fromVersion} → ${toVersion}`;

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
      {tag}
    </TableCell>
  );
}
