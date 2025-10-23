import type { ReactNode } from "react";
import { forwardRef } from "react";
import { isAfter, subHours } from "date-fns";
import { Check, X } from "lucide-react";
import prettyMilliseconds from "pretty-ms";
import { useInView } from "react-intersection-observer";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
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
  jobStatusSummary: { inSync: number; outOfSync: number };
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Job Status
      </div>
      <div className="flex gap-1">
        {jobStatusSummary.inSync > 0 && (
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
        )}
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        {jobStatusSummary.inSync > 0 && (
          <span>
            {jobStatusSummary.inSync} <Check className="size-4" />
          </span>
        )}
        {jobStatusSummary.outOfSync > 0 && (
          <span>
            {jobStatusSummary.outOfSync} <X className="size-4" />
          </span>
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
  const totalReleaseTargets = rt.data?.total ?? 0;
  const inSyncTargets =
    rt.data?.items.filter(
      (rt) =>
        rt.state.desiredRelease?.version.tag ===
        rt.state.currentRelease?.version.tag,
    ).length ?? 0;
  const outOfSyncTargets = totalReleaseTargets - inSyncTargets;

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
        <DeploymentCardJobStatus
          jobStatusSummary={{
            inSync: inSyncTargets,
            outOfSync: outOfSyncTargets,
          }}
        />
        <DeploymentCardViewButton />
      </DeploymentCardContent>
    </DeploymentCard>
  );
}
