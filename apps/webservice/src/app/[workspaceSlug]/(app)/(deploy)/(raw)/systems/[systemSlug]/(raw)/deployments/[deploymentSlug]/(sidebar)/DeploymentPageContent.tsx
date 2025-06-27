"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useState } from "react";
import { IconFilter, IconFolder, IconLoader2 } from "@tabler/icons-react";
import _ from "lodash";
import { useDebounce } from "react-use";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import {
  ColumnOperator,
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  DeploymentVersionConditionType,
  isComparisonCondition,
} from "@ctrlplane/validators/releases";

import { CollapsibleSearchInput } from "~/app/[workspaceSlug]/(app)/_components/CollapsibleSearchInput";
import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { DeploymentVersionConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionDialog";
import { useDeploymentVersionSelector } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/useDeploymentVersionSelector";
import { api } from "~/trpc/react";
import { VersionRow } from "./_components/VersionRow";

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

const VersionFilter: React.FC = () => {
  const { selector, setSelector } = useDeploymentVersionSelector();

  return (
    <DeploymentVersionConditionDialog
      condition={selector}
      onChange={setSelector}
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
  );
};

const isSearchQuery = (condition: DeploymentVersionCondition) => {
  if (condition.type !== DeploymentVersionConditionType.Comparison)
    return false;
  const { conditions, operator } = condition;
  return (
    conditions.every(
      (c) =>
        c.type === DeploymentVersionConditionType.Name ||
        c.type === DeploymentVersionConditionType.Tag,
    ) && operator === ComparisonOperator.Or
  );
};

const getSearchCondition = (search: string): DeploymentVersionCondition => ({
  type: DeploymentVersionConditionType.Comparison,
  operator: ComparisonOperator.Or,
  conditions: [
    {
      type: DeploymentVersionConditionType.Name,
      operator: ColumnOperator.Contains,
      value: search,
    },
    {
      type: DeploymentVersionConditionType.Tag,
      operator: ColumnOperator.Contains,
      value: search,
    },
  ],
});

const useVersionSearchQuery = () => {
  const [search, setSearch] = useState("");
  const { selector, setSelector } = useDeploymentVersionSelector();

  const otherConditions =
    selector?.type === DeploymentVersionConditionType.Comparison
      ? selector.conditions.filter((c) => !isSearchQuery(c))
      : [];

  useDebounce(
    () => {
      if (search === "") {
        if (selector == null || !isComparisonCondition(selector)) return;
        if (otherConditions.length === 0) {
          setSelector(null);
          return;
        }
        setSelector({
          type: DeploymentVersionConditionType.Comparison,
          operator: ComparisonOperator.And,
          conditions: otherConditions,
        });
        return;
      }

      setSelector({
        type: DeploymentVersionConditionType.Comparison,
        operator: ComparisonOperator.And,
        conditions: [...otherConditions, getSearchCondition(search)],
      });
    },
    500,
    [search],
  );

  return { search, setSearch };
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
  const { selector } = useDeploymentVersionSelector();
  const { search, setSearch } = useVersionSearchQuery();

  const versions = api.deployment.version.list.useQuery(
    { deploymentId: deployment.id, filter: selector ?? undefined, limit: 30 },
    { refetchInterval: 2_000 },
  );

  const loading = versions.isLoading;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 p-1 px-2 text-sm">
        <div className="flex flex-grow items-center gap-2">
          <VersionFilter />
          <CollapsibleSearchInput value={search} onChange={setSearch} />
        </div>

        <TotalBadge total={versions.data?.total} />
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
                  <VersionRow
                    key={version.id}
                    version={version}
                    deployment={deployment}
                    environments={environments}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
