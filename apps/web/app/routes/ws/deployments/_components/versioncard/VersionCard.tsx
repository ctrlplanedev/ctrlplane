import _ from "lodash";
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

import type { ReleaseTargetWithState } from "../types";
import { Badge } from "~/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { useDeploymentStats } from "./useDeploymentStats";
import { VersionDropdown } from "./VersionDropdown";

type DeploymentVersion = {
  id: string;
  name?: string;
  tag: string;
  status: DeploymentVersionStatus;
  createdAt: string | Date;
};

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
    createdAt: Date;
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

const useHasActiveDeployments = (
  currentReleaseTargets: ReleaseTargetWithState[],
  version: DeploymentVersion,
  desiredReleaseTargets: ReleaseTargetWithState[],
) => {
  const [searchParams] = useSearchParams();
  const versionId = searchParams.get("version");
  return (
    currentReleaseTargets.length > 0 ||
    versionId === version.id ||
    desiredReleaseTargets.length > 0
  );
};

type NoActiveDeploymentsProps = {
  version: DeploymentVersion;
  isSelected: boolean;
  onSelect?: () => void;
};

const NoActiveDeployments: React.FC<NoActiveDeploymentsProps> = ({
  onSelect,
  version,
  isSelected,
}) => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const displayName = version.name || version.tag;

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
          <span className="grow truncate overflow-ellipsis text-left">
            {displayName}
          </span>
        </div>
      </div>
    </div>
  );
};

const DeploymentProgress: React.FC<{
  deployed: number;
  totalTargets: number;
}> = ({ deployed, totalTargets }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-600" />
          <span className="text-muted-foreground">{deployed} deployed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-blue-600" />
          <span className="text-muted-foreground">{totalTargets} desired</span>
        </div>
      </div>
    </div>
    {totalTargets > 0 && (
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-green-600 transition-all"
          style={{ width: `${(deployed / totalTargets) * 100}%` }}
        />
        <div
          className="h-full bg-blue-600 transition-all"
          style={{
            width: `${((totalTargets - deployed) / totalTargets) * 100}%`,
          }}
        />
      </div>
    )}
  </div>
);

const PendingPopoverContent: React.FC<{
  targets: ReleaseTargetWithState[];
}> = ({ targets }) => {
  if (targets.length <= 10)
    return (
      <div className="space-y-1">
        <div className="font-medium">Waiting to deploy:</div>
        {targets.map((rt) => (
          <div key={rt.releaseTarget.resourceId} className="text-xs">
            {rt.resource.name}
          </div>
        ))}
      </div>
    );

  const grouped = _.groupBy(targets, (rt) => rt.environment.name);
  return (
    <div className="space-y-1">
      <div className="font-medium">Waiting to deploy:</div>
      {Object.entries(grouped).map(([envName, rts]) => (
        <div key={envName} className="text-xs">
          {envName}: {rts.length} resource{rts.length !== 1 ? "s" : ""}
        </div>
      ))}
    </div>
  );
};

const formatJobStatus = (status: string) => {
  switch (status) {
    case "failure":
      return "Job failed";
    case "invalidJobAgent":
      return "Invalid job agent";
    case "invalidIntegration":
      return "Invalid integration";
    case "externalRunNotFound":
      return "External run not found";
    default:
      return status;
  }
};

const FailedPopoverContent: React.FC<{
  targets: ReleaseTargetWithState[];
}> = ({ targets }) => (
  <div className="space-y-1.5">
    <div className="font-medium">Failed deployments:</div>
    {targets.map((rt) => (
      <div key={rt.releaseTarget.resourceId} className="text-xs">
        <span className="font-medium">{rt.resource.name}</span>
        {rt.latestJob?.status && (
          <span className="text-muted-foreground">
            {" "}
            — {formatJobStatus(rt.latestJob.status)}
          </span>
        )}
        {rt.latestJob?.message && (
          <div className="mt-0.5 text-muted-foreground">
            {rt.latestJob.message}
          </div>
        )}
      </div>
    ))}
  </div>
);

const DeploymentIssues: React.FC<{
  pending: number;
  pendingTargets: ReleaseTargetWithState[];
  failed: number;
  failedTargets: ReleaseTargetWithState[];
}> = ({ pending, pendingTargets, failed, failedTargets }) => {
  if (pending === 0 && failed === 0) return null;
  return (
    <div className="space-y-1.5 border-t pt-2">
      {pending > 0 && (
        <Popover>
          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
            <div className="flex cursor-pointer items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="text-muted-foreground">
                {pending} waiting to deploy
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            className="max-w-64 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <PendingPopoverContent targets={pendingTargets} />
          </PopoverContent>
        </Popover>
      )}
      {failed > 0 && (
        <Popover>
          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
            <div className="flex cursor-pointer items-center gap-1.5 text-xs">
              <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span className="text-red-600">
                {failed} deployment{failed !== 1 ? "s" : ""} failed
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            className="max-w-64 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <FailedPopoverContent targets={failedTargets} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

const EnvironmentCount: React.FC<{ environmentCount: number }> = ({
  environmentCount,
}) => {
  if (environmentCount === 0) return null;
  return (
    <div>
      <Badge variant="outline" className="text-xs">
        {environmentCount}{" "}
        {environmentCount === 1 ? "environment" : "environments"}
      </Badge>
    </div>
  );
};

const VersionHeader: React.FC<{
  version: DeploymentVersion;
  displayName: string;
}> = ({ version, displayName }) => (
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
      <div className="grow" />
      <VersionDropdown version={version} />
    </div>
  </div>
);

export const VersionCard: React.FC<VersionCardProps> = ({
  version,
  currentReleaseTargets,
  desiredReleaseTargets,
  isSelected = false,
  onSelect,
}) => {
  const hasActiveDeployments = useHasActiveDeployments(
    currentReleaseTargets,
    version,
    desiredReleaseTargets,
  );

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const displayName = version.name || version.tag;

  const deploymentStats = useDeploymentStats(
    currentReleaseTargets,
    desiredReleaseTargets,
  );

  const timeAgo = `${prettyMs(
    Date.now() - new Date(version.createdAt).getTime(),
    { hideSeconds: true },
  )} ago`;

  if (!hasActiveDeployments)
    return (
      <NoActiveDeployments
        onSelect={onSelect}
        version={version}
        isSelected={isSelected}
      />
    );

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
      <VersionHeader version={version} displayName={displayName} />
      <Separator />
      <div className="flex-1 space-y-2.5">
        <DeploymentProgress {...deploymentStats} />
        <DeploymentIssues {...deploymentStats} />
        <EnvironmentCount {...deploymentStats} />
      </div>

      <div className="mt-auto text-xs text-muted-foreground">{timeAgo}</div>
    </div>
  );
};

export type { DeploymentVersionStatus };
