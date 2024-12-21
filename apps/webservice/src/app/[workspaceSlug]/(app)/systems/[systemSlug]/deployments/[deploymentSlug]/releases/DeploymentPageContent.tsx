"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import { useParams, useRouter } from "next/navigation";
import {
  IconFilter,
  IconGraph,
  IconHistory,
  IconSettings,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";

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

import { useReleaseChannelDrawer } from "~/app/[workspaceSlug]/(app)/_components/release-channel-drawer/useReleaseChannelDrawer";
import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/release-condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/release-condition/ReleaseConditionDialog";
import { useReleaseFilter } from "~/app/[workspaceSlug]/(app)/_components/release-condition/useReleaseFilter";
import { api } from "~/trpc/react";
import { LazyReleaseEnvironmentCell } from "../../ReleaseEnvironmentCell";
import {
  EnvironmentColumnSelector,
  useEnvironmentColumnSelector,
} from "./EnvironmentColumnSelector";
import { JobHistoryPopover } from "./JobHistoryPopover";
import { ReleaseDistributionGraphPopover } from "./ReleaseDistributionPopover";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type Deployment = NonNullable<RouterOutputs["deployment"]["bySlug"]>;

type DeploymentPageContentProps = {
  deployment: Deployment;
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

  const loading = releases.isLoading;
  const router = useRouter();

  const {
    selectedEnvironmentIds,
    setEnvironmentIdSelected,
    setEnvironmentIds,
  } = useEnvironmentColumnSelector(environments);

  const selectedEnvironments = environments.filter((e) =>
    selectedEnvironmentIds.includes(e.id),
  );

  const numEnvironmentBlocks = Math.min(3, selectedEnvironments.length);

  return (
    <div>
      <div className="h-full text-sm">
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

          <EnvironmentColumnSelector
            environments={environments}
            selectedEnvironmentIds={selectedEnvironmentIds}
            onSelectEnvironment={setEnvironmentIdSelected}
            onSetEnvironmentIds={setEnvironmentIds}
          />

          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {releases.data?.total ?? "-"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <ReleaseDistributionGraphPopover deployment={deployment}>
              <Button
                variant="ghost"
                size="icon"
                className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
              >
                <IconGraph className="h-4 w-4" />
              </Button>
            </ReleaseDistributionGraphPopover>
            {releaseIds.length > 0 && (
              <JobHistoryPopover deploymentId={deployment.id}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
                >
                  <IconHistory className="h-4 w-4" />
                </Button>
              </JobHistoryPopover>
            )}
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
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[500px] p-0">
                  <div className="flex h-[40px] items-center pl-2 backdrop-blur-sm">
                    Version
                  </div>
                </TableHead>
                {selectedEnvironments.map((env) => (
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
                  {selectedEnvironments.map((env) => (
                    <TableCell
                      className={cn(
                        "h-[60px] w-[220px] border-l",
                        releaseIdx === releases.data.items.length - 1 &&
                          "border-b",
                      )}
                      onClick={(e) => e.stopPropagation()}
                      key={env.id}
                    >
                      <LazyReleaseEnvironmentCell
                        environment={env}
                        deployment={deployment}
                        release={release}
                        blockedEnv={blockedEnvByRelease.data?.find(
                          (b) => b.environmentId === env.id,
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
