import { useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  XCircle,
} from "lucide-react";
import prettyMs from "pretty-ms";
import { useSearchParams } from "react-router";

import type { ReleaseTargetWithState } from "./types";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

type DeploymentVersionStatus =
  | "unspecified"
  | "building"
  | "ready"
  | "failed"
  | "rejected"
  | "paused";

type VersionCardProps = {
  version: {
    id: string;
    name?: string;
    tag: string;
    status: DeploymentVersionStatus;
    createdAt: string;
  };
  currentReleaseTargets: ReleaseTargetWithState[];
  desiredReleaseTargets: ReleaseTargetWithState[];
  isSelected?: boolean;
  onSelect?: () => void;
};

const getVersionStatusColor = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return "text-green-600 border-green-500/20";
    case "building":
      return "text-blue-600 border-blue-500/20";
    case "failed":
      return "text-red-600 border-red-500/20";
    case "rejected":
      return "text-amber-600 border-amber-500/20";
    case "paused":
      return "text-neutral-600 border-neutral-500/20";
    default:
      return "text-neutral-600 border-neutral-500/20";
  }
};

const getVersionStatusIcon = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="h-4 w-4" />;
    case "building":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4" />;
    case "rejected":
      return <Pause className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

export const VersionCard: React.FC<VersionCardProps> = ({
  version,
  currentReleaseTargets,
  desiredReleaseTargets,
  isSelected = false,
  onSelect,
}) => {
  const [searchParams] = useSearchParams();
  const versionId = searchParams.get("version");
  const hasActiveDeployments =
    currentReleaseTargets.length > 0 ||
    versionId === version.id ||
    desiredReleaseTargets.length > 0;

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const displayName = version.name || version.tag;

  // Calculate deployment states
  const deploymentStats = useMemo(() => {
    const currentTargetIds = new Set(
      currentReleaseTargets.map(
        (rt) =>
          `${rt.releaseTarget.deploymentId}-${rt.releaseTarget.environmentId}-${rt.releaseTarget.resourceId}`,
      ),
    );

    // Pending: desired but not current
    const pendingTargets = desiredReleaseTargets.filter(
      (rt) =>
        !currentTargetIds.has(
          `${rt.releaseTarget.deploymentId}-${rt.releaseTarget.environmentId}-${rt.releaseTarget.resourceId}`,
        ),
    );

    // Failed: check latestJob status for failure states
    const failureStatuses = [
      "failure",
      "invalidJobAgent",
      "invalidIntegration",
      "externalRunNotFound",
    ];
    const failedTargets = desiredReleaseTargets.filter((rt) => {
      // Check if state has latestJob with a failure status
      const latestJob = (rt.state as any).latestJob;
      return latestJob && failureStatuses.includes(latestJob.status);
    });

    // Get unique environment IDs
    const currentEnvIds = new Set(
      currentReleaseTargets.map((rt) => rt.releaseTarget.environmentId),
    );
    const desiredEnvIds = new Set(
      desiredReleaseTargets.map((rt) => rt.releaseTarget.environmentId),
    );

    return {
      deployed: currentReleaseTargets.length,
      pending: pendingTargets.length,
      failed: failedTargets.length,
      totalTargets: desiredReleaseTargets.length,
      environmentCount: new Set([...currentEnvIds, ...desiredEnvIds]).size,
    };
  }, [currentReleaseTargets, desiredReleaseTargets]);

  const timeAgo = `${prettyMs(
    Date.now() - new Date(version.createdAt).getTime(),
    { hideSeconds: true },
  )} ago`;

  if (!hasActiveDeployments) {
    return (
      <div
        onClick={onSelect}
        className={cn(
          "w-10 shrink-0 cursor-pointer rounded-md border bg-card p-3 text-sm text-muted-foreground transition-colors",
          isSelected
            ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
            : "hover:border-primary/50 hover:text-foreground",
        )}
      >
        <div className="flex rotate-90 items-center font-mono ">
          <div className="flex w-[185px] items-center gap-2">
            <span className="shrink-0">
              {getVersionStatusIcon(version.status)}
            </span>
            <span className="flex-grow truncate overflow-ellipsis text-left">
              {displayName}
            </span>
            {/* <span className="ml-1 shrink-0 text-right text-xs text-muted-foreground">
              {prettyMs(Date.now() - new Date(version.createdAt).getTime(), {
                hideSeconds: true,
                compact: true,
              })}{" "}
            </span> */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex shrink-0 cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 text-sm transition-colors",
        "h-[220px] w-[180px]",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "hover:border-primary/50",
      )}
    >
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-1 overflow-ellipsis font-mono font-semibold",
          )}
        >
          <span className={`mr-1 ${getVersionStatusColor(version.status)}`}>
            {getVersionStatusIcon(version.status)}
          </span>

          <span className="truncate">{displayName}</span>
        </div>
      </div>

      <Separator />

      <div className="flex-1 space-y-2.5">
        {/* Main status summary */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-600" />
                <span className="text-muted-foreground">
                  {deploymentStats.deployed} deployed
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                <span className="text-muted-foreground">
                  {deploymentStats.totalTargets} desired
                </span>
              </div>
            </div>
          </div>
          {deploymentStats.totalTargets > 0 && (
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-600 transition-all"
                style={{
                  width: `${(deploymentStats.deployed / deploymentStats.totalTargets) * 100}%`,
                }}
              />
              <div
                className="h-full bg-blue-600 transition-all"
                style={{
                  width: `${((deploymentStats.totalTargets - deploymentStats.deployed) / deploymentStats.totalTargets) * 100}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Issues that need attention */}
        {(deploymentStats.pending > 0 || deploymentStats.failed > 0) && (
          <div className="space-y-1.5 border-t pt-2">
            {deploymentStats.pending > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="text-muted-foreground">
                  {deploymentStats.pending} waiting to deploy
                </span>
              </div>
            )}
            {deploymentStats.failed > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                <span className="text-red-600">
                  {deploymentStats.failed} deployment
                  {deploymentStats.failed !== 1 ? "s" : ""} failed
                </span>
              </div>
            )}
          </div>
        )}

        {/* Environment badge */}
        {deploymentStats.environmentCount > 0 && (
          <div>
            <Badge variant="outline" className="text-xs">
              {deploymentStats.environmentCount}{" "}
              {deploymentStats.environmentCount === 1
                ? "environment"
                : "environments"}
            </Badge>
          </div>
        )}
      </div>

      <div className="mt-auto text-xs text-muted-foreground">{timeAgo}</div>
    </div>
  );
};

export type { DeploymentVersionStatus };
