import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { isAfter } from "date-fns";
import _ from "lodash";
import { Search } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { isPresent } from "ts-is-present";

import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useTargetsGroupedByDeployment } from "../_hooks/useEnvironmentReleaseTargets";
import {
  AttentionBadge,
  DeploymentCard,
  DeploymentCardContent,
  DeploymentCardHeader,
  DeploymentCardJobStatus,
  DeploymentCardMetricRow,
  DeploymentCardMetrics,
  DeploymentCardVersionMetric,
  HealthStatusBadge,
  SyncProgressBadge,
} from "../../deployments/_components/DeploymentCard";

type Deployment = WorkspaceEngine["schemas"]["Deployment"];
type ReleaseTargetWithState =
  WorkspaceEngine["schemas"]["ReleaseTargetWithState"];

type DeploymentSummaryCardProps = {
  deployment: Deployment;
  releaseTargets: ReleaseTargetWithState[];
  isLoading: boolean;
};

function HealthSummary({
  releaseTargets,
}: {
  releaseTargets: ReleaseTargetWithState[];
}) {
  const numTargets = releaseTargets.length;
  const isOutOfSync = releaseTargets.some(
    ({ state }) =>
      state.desiredRelease?.version.tag !== state.currentRelease?.version.tag,
  );
  const syncedCount = releaseTargets.filter(
    ({ state }) =>
      state.desiredRelease?.version.tag === state.currentRelease?.version.tag,
  ).length;
  const jobStatusSummary = _.chain(releaseTargets)
    .groupBy(({ state }) => state.latestJob?.job.status ?? "unknown")
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
    <div className="flex flex-wrap gap-2">
      <HealthStatusBadge jobStatusSummary={jobStatusSummary} />
      {needsAttention > 0 && <AttentionBadge count={needsAttention} />}
      {isOutOfSync && numTargets > 0 && (
        <SyncProgressBadge synced={syncedCount} total={numTargets} />
      )}
    </div>
  );
}

function DeploymentSummaryMetrics({
  releaseTargets,
  isLoading,
}: {
  releaseTargets: ReleaseTargetWithState[];
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <DeploymentCardMetrics>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </DeploymentCardMetrics>
    );

  const latestVersion = releaseTargets
    .map(({ state }) => state.currentRelease?.version ?? null)
    .filter(isPresent)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .at(0);

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last24hCount = releaseTargets.filter(
    ({ state }) =>
      state.latestJob?.job.completedAt &&
      isAfter(new Date(state.latestJob.job.completedAt), twentyFourHoursAgo),
  ).length;

  return (
    <DeploymentCardMetrics>
      {latestVersion != null && (
        <DeploymentCardVersionMetric
          tag={latestVersion.tag}
          createdAt={new Date(latestVersion.createdAt)}
        />
      )}
      {latestVersion == null && (
        <>
          <DeploymentCardMetricRow label={"Version"} value={"N/A"} />
          <DeploymentCardMetricRow label={"Created"} value={"N/A"} />
        </>
      )}
      <DeploymentCardMetricRow
        label={"Deployments (24h)"}
        value={last24hCount}
      />
    </DeploymentCardMetrics>
  );
}

function DeploymentJobStatusSummary({
  releaseTargets,
}: {
  releaseTargets: ReleaseTargetWithState[];
  isLoading: boolean;
}) {
  const jobStatusSummary = _.chain(releaseTargets)
    .groupBy(({ state }) => state.latestJob?.job.status ?? "unknown")
    .entries()
    .map(([status, releaseTargets]) => [status, releaseTargets.length])
    .fromPairs()
    .value() as Record<string, number>;

  return <DeploymentCardJobStatus jobStatusSummary={jobStatusSummary} />;
}

function DeploymentSummaryCard({
  deployment,
  releaseTargets,
  isLoading,
}: DeploymentSummaryCardProps) {
  const { workspace } = useWorkspace();
  const { ref } = useInView();
  return (
    <DeploymentCard
      ref={ref}
      to={`/${workspace.slug}/deployments/${deployment.id}`}
    >
      <DeploymentCardHeader
        name={deployment.name}
        systemName={deployment.systemId}
        description={deployment.description}
      />
      <DeploymentCardContent>
        <HealthSummary releaseTargets={releaseTargets} />
        <Separator />
        <DeploymentSummaryMetrics
          releaseTargets={releaseTargets}
          isLoading={isLoading}
        />
        <DeploymentJobStatusSummary
          releaseTargets={releaseTargets}
          isLoading={isLoading}
        />
      </DeploymentCardContent>
    </DeploymentCard>
  );
}

const useFilteredDeployments = () => {
  const { groupedByDeployment, isLoading } = useTargetsGroupedByDeployment();
  const [searchQuery, setSearchQuery] = useState("");
  const filteredDeployments = groupedByDeployment.filter(({ deployment }) =>
    deployment.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  return { filteredDeployments, isLoading, searchQuery, setSearchQuery };
};

export function DeploymentSummaries() {
  const { filteredDeployments, isLoading, searchQuery, setSearchQuery } =
    useFilteredDeployments();

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deployments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredDeployments.map((deploymentSummary) => (
          <DeploymentSummaryCard
            key={deploymentSummary.deployment.id}
            isLoading={isLoading}
            {...deploymentSummary}
          />
        ))}
      </div>
    </div>
  );
}
