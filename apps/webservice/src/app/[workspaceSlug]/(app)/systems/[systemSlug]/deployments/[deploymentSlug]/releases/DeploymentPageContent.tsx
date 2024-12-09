"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useParams, useRouter } from "next/navigation";
import { IconFilter, IconGraph, IconSettings } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import { JobFilterType } from "@ctrlplane/validators/jobs";

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/release-channel-drawer/useReleaseChannelDrawer";
import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/release-condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/release-condition/ReleaseConditionDialog";
import { useReleaseFilter } from "~/app/[workspaceSlug]/(app)/_components/release-condition/useReleaseFilter";
import { api } from "~/trpc/react";
import { DailyJobsChart } from "../../../../../_components/DailyJobsChart";
import { DeployButton } from "../../DeployButton";
import { Release } from "../../TableCells";
import { ReleaseDistributionGraphPopover } from "./ReleaseDistributionPopover";

type Environment = RouterOutputs["environment"]["bySystemId"][number];

type DeploymentPageContentProps = {
  deployment: schema.Deployment & { releaseChannels: schema.ReleaseChannel[] };
  environments: Environment[];
  releaseChannel: schema.ReleaseChannel | null;
};

export const DeploymentPageContent: React.FC<DeploymentPageContentProps> = ({
  deployment,
  environments,
  releaseChannel,
}) => {
  const { filter, setFilter } = useReleaseFilter();
  const { setReleaseChannelId } = useReleaseChannelDrawer();

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const releases = api.release.list.useQuery(
    { deploymentId: deployment.id, filter: filter ?? undefined, limit: 30 },
    { refetchInterval: 2_000 },
  );

  const releaseIds = releases.data?.items.map((r) => r.id) ?? [];
  const blockedEnvByRelease = api.release.blocked.useQuery(releaseIds, {
    enabled: releaseIds.length > 0,
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dailyCounts = api.job.config.byDeploymentId.dailyCount.useQuery(
    { deploymentId: deployment.id, timezone },
    { enabled: releaseIds.length > 0, refetchInterval: 60_000 },
  );
  const totalJobs = (dailyCounts.data ?? []).reduce(
    (acc, c) => acc + Number(c.totalCount),
    0,
  );

  const loading = releases.isLoading;
  const router = useRouter();

  const inDeploymentFilter: JobCondition = {
    type: JobFilterType.Deployment,
    operator: ColumnOperator.Equals,
    value: deployment.id,
  };

  const numEnvironmentBlocks = Math.min(3, environments.length);

  return (
    <div>
      <div className="h-full text-sm">
        <div className="w-[calc(100vw-267px)]">
          <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
              <CardTitle>Job executions</CardTitle>
              <CardDescription>
                Total executions of all jobs in the last 6 weeks
              </CardDescription>
            </div>
            <div className="flex">
              <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
                <span className="text-xs text-muted-foreground">Jobs</span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {totalJobs}
                </span>
              </div>

              <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
                <span className="text-xs text-muted-foreground">Releases</span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {releases.data?.total ?? "-"}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex border-b px-2 sm:p-6">
            <DailyJobsChart
              dailyCounts={dailyCounts.data ?? []}
              baseFilter={inDeploymentFilter}
            />
          </CardContent>
        </div>
        <div className="flex items-center gap-4 border-b border-neutral-800 p-1 px-2">
          <div className="flex flex-grow items-center gap-2">
            <ReleaseConditionDialog
              condition={filter}
              onChange={setFilter}
              releaseChannels={deployment.releaseChannels}
            >
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
                >
                  <IconFilter className="h-4 w-4" />
                </Button>

                {filter != null && releaseChannel == null && (
                  <ReleaseConditionBadge condition={filter} />
                )}
              </div>
            </ReleaseConditionDialog>
            {releaseChannel != null && (
              <div className="flex items-center gap-2">
                <span>{releaseChannel.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setReleaseChannelId(releaseChannel.id)}
                >
                  <IconSettings className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {releases.data?.total ?? "-"}
            </Badge>
          </div>

          <ReleaseDistributionGraphPopover deployment={deployment}>
            <Button
              variant="ghost"
              size="icon"
              className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
            >
              <IconGraph className="h-4 w-4" />
            </Button>
          </ReleaseDistributionGraphPopover>
        </div>
      </div>
      <div className="h-full text-sm">
        {loading && (
          <div className="space-y-2 p-4">
            {_.range(10).map((i) => (
              <Skeleton
                key={i}
                className="h-9 w-full"
                style={{ opacity: 1 * (1 - i / 10) }}
              />
            ))}
          </div>
        )}
        {!loading && releases.data && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[500px] p-0">
                  <div className="flex h-[40px] items-center pl-2 backdrop-blur-sm">
                    Version
                  </div>
                </TableHead>
                {environments.map((env) => (
                  <TableHead className="border-l pl-4" key={env.id}>
                    <div className="flex w-[220px] items-center gap-2">
                      {env.name}
                      <Badge
                        variant="outline"
                        className="rounded-full px-1.5 font-light text-muted-foreground"
                      >
                        {env.resources.length}
                      </Badge>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.data.items.map((release, releaseIdx) => (
                <TableRow
                  key={release.id}
                  className="cursor-pointer hover:bg-transparent"
                  onClick={() =>
                    router.push(
                      `/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}/releases/${release.id}`,
                    )
                  }
                >
                  <TableCell
                    className={cn(
                      "sticky left-0 z-10 min-w-[500px] p-0 text-base",
                      releaseIdx === releases.data.items.length - 1 &&
                        "border-b",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-[60px] items-center gap-2 px-4 backdrop-blur-sm",
                        numEnvironmentBlocks === 3 &&
                          "max-w-[calc(100vw-256px-737px)]",
                        numEnvironmentBlocks === 2 &&
                          "max-w-[calc(100vw-256px-491px)]",
                        numEnvironmentBlocks === 1 &&
                          "max-w-[calc(100vw-256px-246px)]",
                      )}
                    >
                      <span className="truncate">{release.name}</span>{" "}
                      <Badge
                        variant="secondary"
                        className="flex-shrink-0 text-xs hover:bg-secondary"
                      >
                        {formatDistanceToNowStrict(release.createdAt, {
                          addSuffix: true,
                        })}
                      </Badge>
                    </div>
                  </TableCell>
                  {environments.map((env) => {
                    const environmentReleaseReleaseJobTriggers =
                      release.releaseJobTriggers.filter(
                        (t) => t.environmentId === env.id,
                      );

                    const hasResources = env.resources.length > 0;
                    const isAlreadyDeployed =
                      environmentReleaseReleaseJobTriggers.length > 0;
                    const hasJobAgent = deployment.jobAgentId != null;
                    const blockedEnv = blockedEnvByRelease.data?.find(
                      (be) =>
                        be.releaseId === release.id &&
                        be.environmentId === env.id,
                    );
                    const isBlockedByReleaseChannel = blockedEnv != null;

                    const showRelease = isAlreadyDeployed;
                    const showDeployButton =
                      !isAlreadyDeployed &&
                      hasJobAgent &&
                      hasResources &&
                      !isBlockedByReleaseChannel;

                    return (
                      <TableCell
                        className={cn(
                          "h-[60px] w-[220px] border-l",
                          releaseIdx === releases.data.items.length - 1 &&
                            "border-b",
                        )}
                        onClick={(e) => e.stopPropagation()}
                        key={env.id}
                      >
                        <div className="flex w-full items-center justify-center">
                          {showRelease && (
                            <Release
                              workspaceSlug={workspaceSlug}
                              systemSlug={systemSlug}
                              deploymentSlug={deployment.slug}
                              releaseId={release.id}
                              version={release.version}
                              environment={env}
                              name={release.version}
                              deployedAt={
                                environmentReleaseReleaseJobTriggers[0]!
                                  .createdAt
                              }
                              releaseJobTriggers={
                                environmentReleaseReleaseJobTriggers
                              }
                            />
                          )}

                          {showDeployButton && (
                            <DeployButton
                              releaseId={release.id}
                              environmentId={env.id}
                            />
                          )}

                          {!isAlreadyDeployed && (
                            <div className="text-center text-xs text-muted-foreground/70">
                              {isBlockedByReleaseChannel && (
                                <>
                                  Blocked by{" "}
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() =>
                                      setReleaseChannelId(
                                        blockedEnv.releaseChannelId ?? null,
                                      )
                                    }
                                    className="px-0 text-muted-foreground/70"
                                  >
                                    release channel
                                  </Button>
                                </>
                              )}
                              {!isBlockedByReleaseChannel &&
                                !hasJobAgent &&
                                "No job agent"}
                              {!isBlockedByReleaseChannel &&
                                hasJobAgent &&
                                !hasResources &&
                                "No resources"}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
