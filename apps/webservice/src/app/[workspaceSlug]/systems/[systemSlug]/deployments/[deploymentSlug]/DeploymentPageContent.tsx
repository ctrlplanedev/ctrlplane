"use client";

import type * as schema from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/_components/release-condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "~/app/[workspaceSlug]/_components/release-condition/ReleaseConditionDialog";
import { useReleaseFilter } from "~/app/[workspaceSlug]/_components/release-condition/useReleaseFilter";
import { api } from "~/trpc/react";
import { useReleaseDrawer } from "../../../../_components/release-drawer/ReleaseDrawer";
import { DeployButton } from "../DeployButton";
import { Release } from "../TableCells";
import { DistroBarChart } from "./DistroBarChart";

type DeploymentPageContentProps = {
  deployment: schema.Deployment;
  environments: {
    id: string;
    name: string;
    targets: { id: string }[];
  }[];
};

export const DeploymentPageContent: React.FC<DeploymentPageContentProps> = ({
  deployment,
  environments,
}) => {
  const { filter, setFilter } = useReleaseFilter();
  const { setReleaseId } = useReleaseDrawer();

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const releaseJobTriggersQuery = api.job.config.byDeploymentId.useQuery(
    deployment.id,
    { refetchInterval: 2_000 },
  );

  const releasesAll = api.release.list.useQuery(
    { deploymentId: deployment.id, limit: 0 },
    { refetchInterval: 10_000 },
  );

  const releases = api.release.list.useQuery(
    { deploymentId: deployment.id, filter, limit: 30 },
    { refetchInterval: 10_000 },
  );

  const releaseJobTriggers = (releaseJobTriggersQuery.data ?? [])
    .filter(
      (releaseJobTrigger) =>
        isPresent(releaseJobTrigger.environmentId) &&
        isPresent(releaseJobTrigger.releaseId) &&
        isPresent(releaseJobTrigger.targetId),
    )
    .map((releaseJobTrigger) => ({
      ...releaseJobTrigger,
      environmentId: releaseJobTrigger.environmentId,
      target: releaseJobTrigger.target!,
      releaseId: releaseJobTrigger.releaseId,
    }));

  const showPreviousReleaseDistro = 30;

  const distribution = api.deployment.distributionById.useQuery(deployment.id, {
    refetchInterval: 2_000,
  });
  const releaseIds = releases.data?.items.map((r) => r.id) ?? [];
  const blockedEnvByRelease = api.release.blockedEnvironments.useQuery(
    releaseIds,
    { enabled: releaseIds.length > 0 },
  );

  const loading = releases.isLoading || releaseJobTriggersQuery.isLoading;

  return (
    <div>
      <div className="flex border-b">
        <div className="flex flex-1 flex-col justify-center px-6 py-5 sm:py-6">
          <div className="flex items-center gap-2 font-semibold">
            {capitalCase(deployment.name)}{" "}
            {deployment.jobAgentId == null && (
              <Link href={`${deployment.slug}/configure/job-agent`}>
                <Badge
                  variant="outline"
                  className="ml-2 flex w-fit items-center gap-2 border-orange-700 text-orange-700"
                >
                  <IconAlertTriangle className="h-4 w-4" />
                  Job agent not configured
                </Badge>
              </Link>
            )}
          </div>
          <span className="text-muted-foreground">
            Distribution of the last {showPreviousReleaseDistro} releases across
            all targets
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 border-l">
          <div className="col-span-1 flex flex-col gap-2 border-r px-6 py-6">
            <span className="text-xs text-muted-foreground">Releases</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {releasesAll.data?.total ?? "-"}
            </span>
          </div>

          <div className="col-span-1 flex flex-col gap-2 border-neutral-800 px-6 py-6">
            <span className="text-xs text-muted-foreground">Jobs</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {releaseJobTriggers.length}
            </span>
          </div>
        </div>
      </div>
      <div className="border-b px-1 py-2">
        <DistroBarChart
          deploymentId={deployment.id}
          showPreviousReleaseDistro={showPreviousReleaseDistro}
        />
      </div>
      <div className="h-full text-sm">
        <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
          <ReleaseConditionDialog condition={filter} onChange={setFilter}>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
              >
                <IconFilter className="h-4 w-4" />
              </Button>

              {filter != null && <ReleaseConditionBadge condition={filter} />}
            </div>
          </ReleaseConditionDialog>
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {releases.data?.total ?? "-"}
            </Badge>
          </div>
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
          <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 flex h-[calc(100vh-467px)] flex-col overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 z-10 min-w-[500px] p-0">
                    <div className="flex items-center pl-2 backdrop-blur-sm">
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
                          {env.targets.length}
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
                    onClick={() => setReleaseId(release.id)}
                  >
                    <TableCell
                      className={cn(
                        "sticky left-0 z-10 min-w-[500px] pl-4 text-base",
                        releaseIdx === releases.data.items.length - 1 &&
                          "border-b",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {release.name}{" "}
                        <Badge
                          variant="secondary"
                          className="text-xs hover:bg-secondary"
                        >
                          {formatDistanceToNowStrict(release.createdAt, {
                            addSuffix: true,
                          })}
                        </Badge>
                      </div>
                    </TableCell>
                    {environments.map((env) => {
                      const environmentReleaseReleaseJobTriggers =
                        releaseJobTriggers.filter(
                          (t) =>
                            t.releaseId === release.id &&
                            t.environmentId === env.id,
                        );

                      const activeDeploymentCount =
                        distribution.data?.filter(
                          (d) =>
                            d.release.id === release.id &&
                            d.releaseJobTrigger.environmentId === env.id,
                        ).length ?? 0;
                      const hasTargets = env.targets.length > 0;
                      const hasRelease =
                        environmentReleaseReleaseJobTriggers.length > 0;
                      const hasJobAgent = deployment.jobAgentId != null;
                      const isBlockedByPolicyEvaluation = (
                        blockedEnvByRelease.data?.[release.id] ?? []
                      ).includes(env.id);

                      const showRelease = hasRelease;
                      const canDeploy =
                        !hasRelease &&
                        hasJobAgent &&
                        hasTargets &&
                        !isBlockedByPolicyEvaluation;

                      return (
                        <TableCell
                          className={cn(
                            "h-[60px] w-[220px] border-l",
                            releaseIdx === releases.data.items.length - 1 &&
                              "border-b",
                          )}
                        >
                          <div className="flex h-full w-full items-center justify-center">
                            {showRelease && (
                              <Release
                                workspaceSlug={workspaceSlug}
                                systemSlug={systemSlug}
                                deploymentSlug={deployment.slug}
                                releaseId={release.id}
                                environment={env}
                                activeDeploymentCount={activeDeploymentCount}
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

                            {canDeploy && (
                              <DeployButton
                                releaseId={release.id}
                                environmentId={env.id}
                              />
                            )}

                            {!canDeploy && !hasRelease && (
                              <div className="text-center text-xs text-muted">
                                {isBlockedByPolicyEvaluation
                                  ? "Blocked by policy"
                                  : hasJobAgent
                                    ? "No targets"
                                    : "No job agent"}
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
          </div>
        )}
      </div>
    </div>
  );
};
