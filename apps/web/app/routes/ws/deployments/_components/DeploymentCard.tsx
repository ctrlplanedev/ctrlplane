import type { ReactNode } from "react";
import { forwardRef } from "react";
import { isAfter, subHours } from "date-fns";
import _ from "lodash";
import {
  Ban,
  Check,
  CircleEllipsis,
  FileQuestion,
  Loader2,
  MessageCircleWarning,
  ServerCrash,
  SkipForward,
  X,
} from "lucide-react";
import prettyMilliseconds from "pretty-ms";
import { useInView } from "react-intersection-observer";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";

type DeploymentCardProps = {
  children: ReactNode;
  to: string;
};
// Components
export const DeploymentCard = forwardRef<
  HTMLAnchorElement,
  DeploymentCardProps
>(({ children, to }, ref) => {
  return (
    <Link to={to} ref={ref} className="h-full">
      <Card className="group flex h-full cursor-pointer flex-col transition-all hover:border-primary/50 hover:shadow-lg">
        {children}
      </Card>
    </Link>
  );
});

export function DeploymentCardHeader({
  name,
  systemName,
  description,
}: {
  name: string;
  systemName?: string;
  description?: string;
}) {
  return (
    <CardHeader className="pb-0">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <CardTitle className="text-base font-semibold transition-colors group-hover:text-primary">
            {name}
          </CardTitle>
          {systemName && (
            <CardDescription className="text-xs">{systemName}</CardDescription>
          )}
        </div>
      </div>
      {description && (
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      )}
    </CardHeader>
  );
}

export function DeploymentCardContent({ children }: { children: ReactNode }) {
  return (
    <CardContent className="flex flex-1 flex-col space-y-3">
      {children}
    </CardContent>
  );
}

export function DeploymentCardMetrics({ children }: { children: ReactNode }) {
  return <div className="space-y-2 text-sm">{children}</div>;
}

export function DeploymentCardMetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function DeploymentCardVersionMetric({
  tag,
  createdAt,
}: {
  tag: string;
  createdAt: Date;
}) {
  const prettyCreatedAt = prettyMilliseconds(Date.now() - createdAt.getTime(), {
    compact: true,
    hideSeconds: true,
  });
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <span className="shrink-0 text-muted-foreground">Version</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate font-mono">{tag}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tag}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="shrink-0 text-muted-foreground">Created</span>
        <span className="flex items-center gap-1 truncate">
          {prettyCreatedAt}
        </span>
      </div>
    </>
  );
}

const jobStatusBarColor: Record<string, string> = {
  unknown: "bg-gray-500",
  cancelled: "bg-gray-500",
  skipped: "bg-gray-500",
  inProgress: "bg-blue-500",
  actionRequired: "bg-yellow-500",
  pending: "bg-gray-500",
  failure: "bg-red-500",
  invalidJobAgent: "bg-orange-400",
  invalidIntegration: "bg-orange-500",
  externalRunNotFound: "bg-orange-500",
  successful: "bg-green-500",
};

const jobStatusTextColor: Record<string, string> = {
  successful: "text-green-500",
  unknown: "text-gray-500",
  cancelled: "text-gray-500",
  skipped: "text-gray-500",
  inProgress: "text-blue-500",
  invalidJobAgent: "text-orange-500",
  invalidIntegration: "text-orange-500",
  externalRunNotFound: "text-orange-500",
  actionRequired: "text-yellow-500",
  pending: "text-gray-500",
  failure: "text-red-500",
};

const jobStatusDisplayName: Record<string, string> = {
  successful: "Successful",
  unknown: "Unknown",
  cancelled: "Cancelled",
  skipped: "Skipped",
  inProgress: "In Progress",
  invalidJobAgent: "Invalid Job Agent",
  invalidIntegration: "Invalid Integration",
  externalRunNotFound: "External Run Not Found",
  actionRequired: "Action Required",
  pending: "Pending",
  failure: "Failure",
};

const jobStatusIcons: Record<string, ReactNode> = {
  successful: <Check className="size-2.5" />,
  unknown: <FileQuestion className="size-2.5" />,
  cancelled: <Ban className="size-2.5" />,
  skipped: <SkipForward className="size-2.5" />,
  inProgress: <Loader2 className="size-2.5 animate-spin" />,
  invalidJobAgent: <ServerCrash className="size-2.5" />,
  invalidIntegration: <ServerCrash className="size-2.5" />,
  externalRunNotFound: <ServerCrash className="size-2.5" />,
  actionRequired: <MessageCircleWarning className="size-2.5" />,
  pending: <CircleEllipsis className="size-2.5" />,
  failure: <X className="size-2.5" />,
};

export function DeploymentCardJobStatus({
  jobStatusSummary,
}: {
  jobStatusSummary: Record<string, number>;
}) {
  console.log(jobStatusSummary);
  const jobStatuses = Object.entries(jobStatusSummary);
  const jobStatusesWithColors = jobStatuses.map(([status, count]) => ({
    status,
    count,
    color: jobStatusBarColor[status],
  }));
  const jobStatusesWithColorsSorted = jobStatusesWithColors.sort(
    (a, b) => b.count - a.count,
  );
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Job Status
      </div>
      <div className="flex gap-1">
        {jobStatusesWithColorsSorted.map(({ status, count, color }) => (
          <div
            key={status}
            className={cn(color, "h-2 flex-1 rounded-full")}
            style={{ flexGrow: count }}
            title={`${count} ${status}`}
          />
        ))}
        {/* {jobStatusSummary.inSync > 0 && (
          <div
            className="h-2 flex-1 rounded-sm bg-green-500"
            style={{ flexGrow: jobStatusSummary.inSync }}
            title={`${jobStatusSummary.inSync} in sync`}
          />
        )}
        {jobStatusSummary.outOfSync > 0 && (
          <div
            className="h-2 flex-1 rounded-sm bg-blue-500"
            style={{ flexGrow: jobStatusSummary.outOfSync }}
            title={`${jobStatusSummary.outOfSync} out of sync`}
          />
        )} */}
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        {jobStatusesWithColorsSorted.map(({ status, count }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div
                  key={status}
                  className={`flex items-center gap-1 ${jobStatusTextColor[status]}`}
                >
                  {jobStatusIcons[status]}
                  {count}
                </div>
              </TooltipTrigger>
              <TooltipContent>{jobStatusDisplayName[status]}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}

export function DeploymentCardViewButton() {
  return (
    <Button variant="outline" className="mt-auto w-full" size="sm">
      View Details
    </Button>
  );
}

type LazyLoadDeploymentCardProps = {
  deployment: { id: string; name: string; description?: string };
  system: { id: string; name: string };
};

export const HealthStatusBadge: React.FC<{
  jobStatusSummary: Record<string, number>;
}> = ({ jobStatusSummary }) => {
  const hasInProgress = jobStatusSummary.inProgress > 0;
  const hasFailures =
    (jobStatusSummary.failure || 0) +
      (jobStatusSummary.invalidJobAgent || 0) +
      (jobStatusSummary.invalidIntegration || 0) +
      (jobStatusSummary.externalRunNotFound || 0) >
    0;
  const hasSuccessful = jobStatusSummary.successful > 0;
  const allFailed = hasFailures && !hasSuccessful;

  let status: string;
  let tooltip: string;
  let className: string;

  if (hasInProgress) {
    status = "Progressing";
    tooltip = "Deployment jobs are currently running";
    className = "border-blue-400 bg-blue-50 text-xs text-blue-700";
  } else if (allFailed) {
    status = "Unhealthy";
    tooltip = "All deployment jobs have failed or have critical issues";
    className = "border-red-400 bg-red-50 text-xs text-red-700";
  } else if (hasFailures) {
    status = "Degraded";
    tooltip = "Some deployment jobs have failed, but others are successful";
    className = "border-orange-400 bg-orange-50 text-xs text-orange-700";
  } else {
    status = "Healthy";
    tooltip = "All deployment jobs completed successfully";
    className = "border-green-400 bg-green-50 text-xs text-green-700";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={className}>
            {status}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const AttentionBadge: React.FC<{ count: number }> = ({ count }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="outline"
            className="border-red-400 bg-red-50 text-xs text-red-700"
          >
            {count} Needs Attention
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {count} {count === 1 ? "job requires" : "jobs require"} immediate
          attention (action required, invalid agent/integration, or external run
          not found)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const SyncProgressBadge: React.FC<{ synced: number; total: number }> = ({
  synced,
  total,
}) => {
  const outOfSync = total - synced;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              outOfSync > 0
                ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                : "border-green-400 bg-green-50 text-green-700",
            )}
          >
            {synced}/{total} Synced
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {synced} {synced === 1 ? "target is" : "targets are"} running the
          desired version, {outOfSync}{" "}
          {outOfSync === 1 ? "target needs" : "targets need"} to be synced
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export function LazyLoadDeploymentCard({
  deployment,
  system,
}: LazyLoadDeploymentCardProps) {
  const { workspace } = useWorkspace();
  const { ref, inView } = useInView();

  const rtQuery = trpc.deployment.releaseTargets.useQuery(
    { workspaceId: workspace.id, deploymentId: deployment.id, limit: 1_000 },
    { enabled: inView },
  );

  const versions = trpc.deployment.versions.useQuery(
    { workspaceId: workspace.id, deploymentId: deployment.id, limit: 1000 },
    { enabled: inView },
  );

  const last24hDeployments = versions.data?.items.filter((version) => {
    const createdAt = new Date(version.createdAt);
    const twentyFourHoursAgo = subHours(new Date(), 24);
    return isAfter(createdAt, twentyFourHoursAgo);
  });

  const numTargets = rtQuery.data?.total ?? 0;

  const releaseTargets = rtQuery.data?.items ?? [];

  const latestVersion = versions.data?.items[0];
  const deploymentsLast24h = last24hDeployments?.length ?? 0;

  const isOutOfSync = releaseTargets.some(
    ({ state }) =>
      state.desiredRelease?.version.tag !== state.currentRelease?.version.tag,
  );

  const syncedCount = releaseTargets.filter(
    ({ state }) =>
      state.desiredRelease?.version.tag === state.currentRelease?.version.tag,
  ).length;

  const jobStatusSummary = _.chain(releaseTargets)
    .groupBy(({ state }) => state.latestJob?.status ?? "unknown")
    .entries()
    .map(([status, releaseTargets]) => [status, releaseTargets.length])
    .fromPairs()
    .value() as Record<string, number>;

  const needsAttention =
    (jobStatusSummary.actionRequired || 0) +
    (jobStatusSummary.invalidJobAgent || 0) +
    (jobStatusSummary.invalidIntegration || 0) +
    (jobStatusSummary.externalRunNotFound || 0);

  return (
    <DeploymentCard
      ref={ref}
      to={`/${workspace.slug}/deployments/${deployment.id}`}
    >
      <DeploymentCardHeader
        name={deployment.name}
        systemName={system.name}
        description={deployment.description}
      />
      <DeploymentCardContent>
        <div className="flex flex-wrap gap-2">
          <HealthStatusBadge jobStatusSummary={jobStatusSummary} />
          {needsAttention > 0 && <AttentionBadge count={needsAttention} />}
          {isOutOfSync && numTargets > 0 && (
            <SyncProgressBadge synced={syncedCount} total={numTargets} />
          )}
        </div>
        <Separator />
        <DeploymentCardMetrics>
          {versions.isLoading ? (
            <>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </>
          ) : (
            <>
              {latestVersion ? (
                <DeploymentCardVersionMetric
                  tag={latestVersion.name || latestVersion.tag}
                  createdAt={new Date(latestVersion.createdAt)}
                />
              ) : (
                <>
                  <DeploymentCardMetricRow label={"Version"} value={"N/A"} />
                  <DeploymentCardMetricRow label={"Created"} value={"N/A"} />
                </>
              )}
              <DeploymentCardMetricRow
                label={"Deployments (24h)"}
                value={deploymentsLast24h}
              />
            </>
          )}
          {rtQuery.isLoading ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            <DeploymentCardMetricRow label={"Targets"} value={numTargets} />
          )}
        </DeploymentCardMetrics>
        <DeploymentCardJobStatus jobStatusSummary={jobStatusSummary} />
        <DeploymentCardViewButton />
      </DeploymentCardContent>
    </DeploymentCard>
  );
}
