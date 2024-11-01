"use client";

import type * as schema from "@ctrlplane/db/schema";
import { useParams, useRouter } from "next/navigation";
import { IconFilter, IconGraph } from "@tabler/icons-react";
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

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/_components/release-channel-drawer/useReleaseChannelDrawer";
import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/_components/release-condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "~/app/[workspaceSlug]/_components/release-condition/ReleaseConditionDialog";
import { useReleaseFilter } from "~/app/[workspaceSlug]/_components/release-condition/useReleaseFilter";
import { api } from "~/trpc/react";
import { DeployButton } from "../../DeployButton";
import { Release } from "../../TableCells";
import { ReleaseDistributionGraphPopover } from "./ReleaseDistributionPopover";

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
  const { setReleaseChannelId } = useReleaseChannelDrawer();

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const releaseJobTriggersQuery = api.job.config.byDeploymentId.useQuery(
    deployment.id,
    { refetchInterval: 2_000 },
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
    .map((releaseJobTrigger) => ({ ...releaseJobTrigger }));

  const distribution = api.deployment.distributionById.useQuery(deployment.id, {
    refetchInterval: 2_000,
  });
  const releaseIds = releases.data?.items.map((r) => r.id) ?? [];
  const blockedEnvByRelease = api.release.blocked.useQuery(releaseIds, {
    enabled: releaseIds.length > 0,
  });

  const loading = releases.isLoading || releaseJobTriggersQuery.isLoading;
  const router = useRouter();

  return (
    <div>
      <div className="h-full text-sm">
        <div className="flex items-center gap-4 border-b border-neutral-800 p-1 px-2">
          <div className="flex-grow">
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
          <div className="flex flex-col">
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
                    onClick={() =>
                      router.push(
                        `/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}/releases/${release.id}`,
                      )
                    }
                  >
                    <TableCell
                      className={cn(
                        "sticky left-0 z-10 min-w-[500px] pl-4 text-base",
                        releaseIdx === releases.data.items.length - 1 &&
                          "border-b",
                      )}
                    >
                      <div className="flex items-center gap-2">
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
                      const blockedEnv = blockedEnvByRelease.data?.find(
                        (be) =>
                          be.releaseId === release.id &&
                          be.environmentId === env.id,
                      );
                      const isBlockedByReleaseChannel = blockedEnv != null;

                      const showRelease = hasRelease;
                      const canDeploy =
                        !hasRelease &&
                        hasJobAgent &&
                        hasTargets &&
                        !isBlockedByReleaseChannel;

                      return (
                        <TableCell
                          className={cn(
                            "h-[60px] w-[220px] border-l",
                            releaseIdx === releases.data.items.length - 1 &&
                              "border-b",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex h-full w-full items-center justify-center">
                            {showRelease && (
                              <Release
                                workspaceSlug={workspaceSlug}
                                systemSlug={systemSlug}
                                deploymentSlug={deployment.slug}
                                releaseId={release.id}
                                version={release.version}
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
                              <div className="text-center text-xs text-muted-foreground/70">
                                {isBlockedByReleaseChannel ? (
                                  <span>
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
                                  </span>
                                ) : (
                                  "No job agent"
                                )}
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
