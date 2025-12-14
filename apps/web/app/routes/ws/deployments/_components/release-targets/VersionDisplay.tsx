/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { TableCell } from "~/components/ui/table";
import { cn } from "~/lib/utils";

type Release = WorkspaceEngine["schemas"]["Release"];
type Job = WorkspaceEngine["schemas"]["Job"];

export function VersionDisplay({
  desiredRelease,
  currentRelease,
  latestJob,
}: {
  desiredRelease?: Release;
  currentRelease?: Release;
  latestJob?: Job;
}) {
  const fromVersion =
    currentRelease?.version.name ||
    currentRelease?.version.tag ||
    "Not yet deployed";
  const toVersion =
    desiredRelease?.version.name || desiredRelease?.version.tag || "unknown";
  const isInSync = fromVersion === toVersion;
  const isProgressing =
    latestJob?.status === "inProgress" || latestJob?.status === "pending";
  const isUnhealthy =
    latestJob?.status === "failure" ||
    latestJob?.status === "invalidJobAgent" ||
    latestJob?.status === "invalidIntegration" ||
    latestJob?.status === "externalRunNotFound";

  const tag = isInSync ? toVersion : `${fromVersion} → ${toVersion}`;

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
