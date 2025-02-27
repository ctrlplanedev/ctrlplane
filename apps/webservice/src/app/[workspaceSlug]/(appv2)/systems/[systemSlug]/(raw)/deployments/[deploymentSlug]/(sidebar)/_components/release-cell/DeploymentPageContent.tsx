"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { ReleaseStatusType } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams, useRouter } from "next/navigation";
import {
  IconCircleFilled,
  IconFilter,
  IconGraph,
  IconHistory,
  IconLoader2,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { ReleaseStatus } from "@ctrlplane/validators/releases";

import { ReleaseConditionBadge } from "~/app/[workspaceSlug]/(appv2)/_components/release/condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "~/app/[workspaceSlug]/(appv2)/_components/release/condition/ReleaseConditionDialog";
import { useReleaseFilter } from "~/app/[workspaceSlug]/(appv2)/_components/release/condition/useReleaseFilter";
import { api } from "~/trpc/react";
import { JobHistoryPopover } from "./JobHistoryPopover";
import { ReleaseDistributionGraphPopover } from "./ReleaseDistributionPopover";
import { LazyReleaseEnvironmentCell } from "./ReleaseEnvironmentCell";

type Environment = RouterOutputs["environment"]["bySystemId"][number];
type Deployment = NonNullable<RouterOutputs["deployment"]["bySlug"]>;

type EnvHeaderProps = { environment: Environment; deployment: Deployment };

const StatusIcon: React.FC<{ status: ReleaseStatusType }> = ({ status }) => {
  if (status === ReleaseStatus.Ready)
    return (
      <div className="relative h-[20px] w-[20px]">
        <IconCircleFilled className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-green-300/20" />
        <IconCircleFilled className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 text-green-300" />
      </div>
    );

  if (status === ReleaseStatus.Building)
    return (
      <div className="relative h-[20px] w-[20px]">
        <IconCircleFilled className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-yellow-400/20" />
        <IconCircleFilled className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 text-yellow-400" />
      </div>
    );

  return (
    <div className="relative h-[20px] w-[20px]">
      <IconCircleFilled className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-red-400/20" />
      <IconCircleFilled className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 text-red-400" />
    </div>
  );
};

const EnvHeader: React.FC<EnvHeaderProps> = ({ environment, deployment }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);
  const workspaceId = workspace?.id ?? "";

  const { resourceFilter: envResourceFilter } = environment;
  const { resourceFilter: deploymentResourceFilter } = deployment;

  const filter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [envResourceFilter, deploymentResourceFilter].filter(isPresent),
  };

  const { data: resourcesResult, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId, filter, limit: 0 },
      { enabled: workspaceId !== "" && envResourceFilter != null },
    );

  const total = resourcesResult?.total ?? 0;

  const isLoading = isWorkspaceLoading || isResourcesLoading;

  return (
    <TableHead className="border-l pl-4">
      <div className="flex w-[220px] items-center gap-2">
        <span className="truncate">{environment.name}</span>
        <Badge
          variant="outline"
          className="rounded-full px-1.5 font-light text-muted-foreground"
        >
          {isLoading && (
            <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!isLoading && total}
        </Badge>
      </div>
    </TableHead>
  );
};

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

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const releases = api.release.list.useQuery(
    { deploymentId: deployment.id, filter: filter ?? undefined, limit: 30 },
    { refetchInterval: 2_000 },
  );

  const releaseIds = releases.data?.items.map((r) => r.id) ?? [];

  const loading = releases.isLoading;
  const router = useRouter();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 p-1 px-2 text-sm">
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
        <div className="flex h-full overflow-auto text-sm">
          <Table className="border-b">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[500px] p-0">
                  <div className="flex h-[40px] items-center bg-background/70 pl-2">
                    Version
                  </div>
                </TableHead>
                {environments.map((env) => (
                  <EnvHeader
                    key={env.id}
                    environment={env}
                    deployment={deployment}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.data.items.map((release) => {
                return (
                  <TableRow
                    key={release.id}
                    className="cursor-pointer hover:bg-transparent"
                    onClick={() =>
                      router.push(
                        `/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}/releases/${release.id}`,
                      )
                    }
                  >
                    <TableCell className="sticky left-0 z-10 flex h-[60px] min-w-[500px] items-center gap-2 bg-background/95 text-base">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <StatusIcon status={release.status} />
                          </TooltipTrigger>
                          <TooltipContent
                            align="start"
                            className="bg-neutral-800 px-2 py-1 text-sm"
                          >
                            <span>
                              {release.status}
                              {release.message && `: ${release.message}`}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="truncate">{release.name}</span>{" "}
                      <Badge
                        variant="secondary"
                        className="flex-shrink-0 text-xs hover:bg-secondary"
                      >
                        {formatDistanceToNowStrict(release.createdAt, {
                          addSuffix: true,
                        })}
                      </Badge>
                    </TableCell>
                    {environments.map((env) => (
                      <TableCell
                        className="h-[60px] w-[220px] border-l px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                        key={env.id}
                      >
                        <LazyReleaseEnvironmentCell
                          environment={env}
                          deployment={deployment}
                          release={release}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
