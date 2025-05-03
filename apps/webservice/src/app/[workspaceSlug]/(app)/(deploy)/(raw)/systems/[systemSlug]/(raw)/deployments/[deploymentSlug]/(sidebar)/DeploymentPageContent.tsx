"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams, useRouter } from "next/navigation";
import {
  IconFilter,
  IconFolder,
  IconGraph,
  IconHistory,
  IconLoader2,
} from "@tabler/icons-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { DeploymentVersionConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionDialog";
import { useDeploymentVersionSelector } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/useDeploymentVersionSelector";
import { DeploymentDirectoryCell } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployments/DeploymentDirectoryCell";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { LazyDeploymentVersionEnvironmentCell } from "./_components/release-cell/DeploymentVersionEnvironmentCell";
import { JobHistoryPopover } from "./_components/release-cell/JobHistoryPopover";
import { VersionDistributionGraphPopover } from "./_components/release-cell/VersionDistributionPopover";

type Deployment = NonNullable<RouterOutputs["deployment"]["bySlug"]>;

type TotalBadgeProps = {
  total: number | undefined;
  label?: string;
  className?: string;
};

const TotalBadge: React.FC<TotalBadgeProps> = ({
  total,
  label = "Total:",
  className,
}) => (
  <div
    className={cn(
      "flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground",
      className,
    )}
  >
    {label}
    <Badge
      variant="outline"
      className="rounded-full border-neutral-800 text-inherit"
    >
      {total ?? "-"}
    </Badge>
  </div>
);

type EnvHeaderProps = {
  environment: schema.Environment;
  deployment: Deployment;
  workspace: schema.Workspace;
};

const EnvHeader: React.FC<EnvHeaderProps> = ({
  environment,
  deployment,
  workspace,
}) => {
  const { resourceSelector: envResourceSelector } = environment;
  const { resourceSelector: deploymentResourceSelector } = deployment;

  const condition: ResourceCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [envResourceSelector, deploymentResourceSelector].filter(
      isPresent,
    ),
  };

  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.id, filter: condition, limit: 0 },
    { enabled: envResourceSelector != null },
  );

  const total = data?.total ?? 0;

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

type DirectoryHeaderProps = {
  directory: { path: string; environments: schema.Environment[] };
  workspace: schema.Workspace;
};

const DirectoryHeader: React.FC<DirectoryHeaderProps> = ({
  directory,
  workspace,
}) => {
  const resourceSelectors = directory.environments
    .map((env) => env.resourceSelector)
    .filter(isPresent);
  const condition: ResourceCondition | undefined =
    resourceSelectors.length > 0
      ? {
          type: ConditionType.Comparison,
          operator: ComparisonOperator.Or,
          conditions: resourceSelectors,
        }
      : undefined;

  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.id, filter: condition, limit: 0 },
    { enabled: condition != null },
  );

  const total = data?.total ?? 0;

  return (
    <TableHead className="w-[220px] border-l p-2" key={directory.path}>
      <div className="flex w-fit items-center gap-2 px-2 py-1 text-white">
        <span className="max-w-32 truncate">{directory.path}</span>

        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {isLoading && (
            <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!isLoading && total}
        </Badge>

        <Badge variant="outline" className="rounded-full text-muted-foreground">
          <IconFolder className="h-4 w-4" strokeWidth={1.5} />
        </Badge>
      </div>
    </TableHead>
  );
};

type DeploymentPageContentProps = {
  workspace: schema.Workspace;
  deployment: Deployment;
  environments: schema.Environment[];
  directories: { path: string; environments: schema.Environment[] }[];
};

export const DeploymentPageContent: React.FC<DeploymentPageContentProps> = ({
  workspace,
  deployment,
  environments,
  directories,
}) => {
  const { selector, setSelector } = useDeploymentVersionSelector();

  const { systemSlug } = useParams<{ systemSlug: string }>();

  const versions = api.deployment.version.list.useQuery(
    { deploymentId: deployment.id, filter: selector ?? undefined, limit: 30 },
    { refetchInterval: 2_000 },
  );

  const versionIds = versions.data?.items.map((v) => v.id) ?? [];

  const loading = versions.isLoading;
  const router = useRouter();

  const versionUrl = urls
    .workspace(workspace.slug)
    .system(systemSlug)
    .deployment(deployment.slug).release;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 p-1 px-2 text-sm">
        <div className="flex flex-grow items-center gap-2">
          <DeploymentVersionConditionDialog
            condition={selector}
            onChange={setSelector}
            deploymentVersionChannels={deployment.versionChannels}
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
              >
                <IconFilter className="h-4 w-4" />
              </Button>

              {selector != null && (
                <DeploymentVersionConditionBadge condition={selector} />
              )}
            </div>
          </DeploymentVersionConditionDialog>
        </div>

        <TotalBadge total={versions.data?.total} />

        <div className="flex items-center gap-2">
          <VersionDistributionGraphPopover deployment={deployment}>
            <Button
              variant="ghost"
              size="icon"
              className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
            >
              <IconGraph className="h-4 w-4" />
            </Button>
          </VersionDistributionGraphPopover>
          {versionIds.length > 0 && (
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

      {!loading && versions.data && (
        <div className="flex h-full overflow-auto text-sm">
          <Table className="border-b">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[500px] p-0">
                  <div className="flex h-[40px] items-center bg-background/70 pl-2">
                    Name
                  </div>
                </TableHead>
                {environments.map((env) => (
                  <EnvHeader
                    key={env.id}
                    environment={env}
                    deployment={deployment}
                    workspace={workspace}
                  />
                ))}
                {directories.map((dir) => (
                  <DirectoryHeader
                    key={dir.path}
                    directory={dir}
                    workspace={workspace}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.data.items.map((version) => {
                return (
                  <TableRow
                    key={version.id}
                    className="cursor-pointer hover:bg-transparent"
                    onClick={() =>
                      router.push(versionUrl(version.id).baseUrl())
                    }
                  >
                    <TableCell className="sticky left-0 z-10 flex h-[70px] min-w-[400px] max-w-[750px] items-center gap-2 bg-background/95 py-0 pl-4 text-base">
                      <span className="truncate">{version.name}</span>{" "}
                      <Badge
                        variant="secondary"
                        className="flex-shrink-0 text-xs hover:bg-secondary"
                      >
                        {formatDistanceToNowStrict(version.createdAt, {
                          addSuffix: true,
                        })}
                      </Badge>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={cn({
                                "bg-green-500/20 text-green-500 hover:bg-green-500/20":
                                  version.status ===
                                  DeploymentVersionStatus.Ready,
                                "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20":
                                  version.status ===
                                  DeploymentVersionStatus.Building,
                                "bg-red-500/20 text-red-500 hover:bg-red-500/20":
                                  version.status ===
                                  DeploymentVersionStatus.Failed,
                              })}
                            >
                              {version.status}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent
                            align="start"
                            className="bg-neutral-800 px-2 py-1 text-sm"
                          >
                            <span>
                              {version.status}
                              {version.message && `: ${version.message}`}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    {environments.map((env) => (
                      <TableCell
                        className="h-[70px] w-[220px] border-l px-2 py-0"
                        onClick={(e) => e.stopPropagation()}
                        key={env.id}
                      >
                        <LazyDeploymentVersionEnvironmentCell
                          environment={env}
                          deployment={deployment}
                          deploymentVersion={version}
                          system={{ slug: systemSlug }}
                        />
                      </TableCell>
                    ))}
                    {directories.map((dir) => (
                      <TableCell
                        key={dir.path}
                        className="h-[70px] w-[220px] border-l"
                      >
                        <div className="w-[220px] shrink-0">
                          <DeploymentDirectoryCell
                            key={dir.path}
                            directory={dir}
                            deployment={deployment}
                            deploymentVersion={version}
                            systemSlug={systemSlug}
                          />
                        </div>
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
