import type { ReactNode } from "react";
import { forwardRef } from "react";
import { isAfter, subHours } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Pause,
  RefreshCw,
  XCircle,
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
import { useWorkspace } from "~/components/WorkspaceProvider";

// Types
type DeploymentCardVersionStatus =
  | "unspecified"
  | "building"
  | "ready"
  | "failed"
  | "rejected";

type DeploymentCardJobStatusSummary = {
  successful: number;
  inProgress: number;
  failed: number;
  pending: number;
  other: number;
};

type DeploymentCardHealthStatus = {
  status: string;
  color: string;
};

type DeploymentCardProps = {
  children: ReactNode;
  to: string;
};
// Components
const DeploymentCard = forwardRef<HTMLAnchorElement, DeploymentCardProps>(
  ({ children, to }, ref) => {
    return (
      <Link to={to} ref={ref}>
        <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg">
          {children}
        </Card>
      </Link>
    );
  },
);

function DeploymentCardHeader({
  name,
  systemName,
  description,
}: {
  name: string;
  systemName?: string;
  description?: string;
}) {
  return (
    <CardHeader className="pb-3">
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

function DeploymentCardContent({ children }: { children: ReactNode }) {
  return <CardContent className="space-y-3">{children}</CardContent>;
}

function DeploymentCardHealthBadge({
  health,
}: {
  health: DeploymentCardHealthStatus;
}) {
  return (
    <Badge className={health.color}>
      {health.status === "Healthy" && <CheckCircle2 className="h-4 w-4" />}
      {health.status === "Progressing" && <RefreshCw className="h-4 w-4" />}
      {health.status === "Degraded" && <XCircle className="h-4 w-4" />}
      <span className="ml-1">{health.status}</span>
    </Badge>
  );
}

function DeploymentCardVersionBadge({
  status,
}: {
  status: DeploymentCardVersionStatus;
}) {
  const getStatusColor = () => {
    switch (status) {
      case "ready":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "building":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "rejected":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="h-4 w-4" />;
      case "building":
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4" />;
      case "rejected":
        return <Pause className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Badge className={getStatusColor()}>
      {getStatusIcon()}
      <span className="ml-1 capitalize">{status}</span>
    </Badge>
  );
}

function DeploymentCardBadges({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function DeploymentCardMetrics({ children }: { children: ReactNode }) {
  return <div className="space-y-2 text-sm">{children}</div>;
}

function DeploymentCardMetricRow({
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

function DeploymentCardVersionMetric({
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
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Latest Version</span>
        <span className="font-mono">{tag}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Created</span>
        <span className="flex items-center gap-1">{prettyCreatedAt}</span>
      </div>
    </>
  );
}

function DeploymentCardJobStatus({
  jobStatusSummary,
}: {
  jobStatusSummary: DeploymentCardJobStatusSummary;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Job Status
      </div>
      <div className="flex gap-1">
        {jobStatusSummary.successful > 0 && (
          <div
            className="h-2 flex-1 rounded-sm bg-green-500"
            style={{ flexGrow: jobStatusSummary.successful }}
            title={`${jobStatusSummary.successful} successful`}
          />
        )}
        {jobStatusSummary.inProgress > 0 && (
          <div
            className="h-2 flex-1 rounded-sm bg-blue-500"
            style={{ flexGrow: jobStatusSummary.inProgress }}
            title={`${jobStatusSummary.inProgress} in progress`}
          />
        )}
        {jobStatusSummary.pending > 0 && (
          <div
            className="h-2 flex-1 rounded-sm bg-amber-500"
            style={{ flexGrow: jobStatusSummary.pending }}
            title={`${jobStatusSummary.pending} pending`}
          />
        )}
        {jobStatusSummary.failed > 0 && (
          <div
            className="h-2 flex-1 rounded-sm bg-red-500"
            style={{ flexGrow: jobStatusSummary.failed }}
            title={`${jobStatusSummary.failed} failed`}
          />
        )}
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        {jobStatusSummary.successful > 0 && (
          <span>{jobStatusSummary.successful} ✓</span>
        )}
        {jobStatusSummary.inProgress > 0 && (
          <span>{jobStatusSummary.inProgress} ⟳</span>
        )}
        {jobStatusSummary.pending > 0 && (
          <span>{jobStatusSummary.pending} ⋯</span>
        )}
        {jobStatusSummary.failed > 0 && (
          <span>{jobStatusSummary.failed} ✗</span>
        )}
      </div>
    </div>
  );
}

function DeploymentCardViewButton() {
  return (
    <Button variant="outline" className="w-full" size="sm">
      View Details
    </Button>
  );
}

// Calculate overall health based on job statuses
const getDeploymentHealth = (
  jobSummary: DeploymentCardJobStatusSummary,
): DeploymentCardHealthStatus => {
  const total = Object.values(jobSummary).reduce(
    (a, b) => Number(a) + Number(b),
    0,
  );
  if (total === 0)
    return {
      status: "Unknown",
      color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };

  if (jobSummary.failed > 0) {
    return {
      status: "Degraded",
      color: "bg-red-500/10 text-red-600 border-red-500/20",
    };
  }
  if (jobSummary.inProgress > 0 || jobSummary.pending > 0) {
    return {
      status: "Progressing",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    };
  }
  if (jobSummary.successful === total) {
    return {
      status: "Healthy",
      color: "bg-green-500/10 text-green-600 border-green-500/20",
    };
  }
  return {
    status: "Unknown",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };
};

type LazyLoadDeploymentCardProps = {
  deployment: { id: string; name: string; description?: string };
  system: { id: string; name: string };
};
export function LazyLoadDeploymentCard({
  deployment,
  system,
}: LazyLoadDeploymentCardProps) {
  const { workspace } = useWorkspace();
  const { ref, inView } = useInView();

  const rt = trpc.deployment.releaseTargets.useQuery(
    { workspaceId: workspace.id, deploymentId: deployment.id, limit: 1 },
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

  const numTargets = rt.data?.total ?? 0;

  const latestVersion = versions.data?.items[0];
  const deploymentsLast24h = last24hDeployments?.length ?? 0;
  const jobStatusSummary = {
    successful: 12,
    inProgress: 0,
    failed: 0,
    pending: 0,
    other: 0,
  };
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
        <DeploymentCardBadges>
          <DeploymentCardHealthBadge
            health={getDeploymentHealth(jobStatusSummary)}
          />
          <DeploymentCardVersionBadge status={"ready"} />
        </DeploymentCardBadges>
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
                  tag={latestVersion.tag}
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
          {rt.isLoading ? (
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
