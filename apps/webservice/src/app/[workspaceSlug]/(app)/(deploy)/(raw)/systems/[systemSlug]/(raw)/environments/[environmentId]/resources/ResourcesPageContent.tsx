"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconFilter,
  IconGrid3x3,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
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
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { ResourceConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionDialog";
import { api } from "~/trpc/react";
import { ResourceCard } from "./_components/ResourceCard";
import { useFilteredResources } from "./_hooks/useFilteredResources";

const PAGE_SIZE = 8;

const safeParseInt = (value: string, total: number) => {
  try {
    const page = parseInt(value);
    if (Number.isNaN(page) || page < 0 || page * PAGE_SIZE >= total) return 0;
    return page;
  } catch {
    return 0;
  }
};

const usePagination = (total: number) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = safeParseInt(searchParams.get("page") ?? "0", total);
  const setPage = (page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page.toString());
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };
  return { page, setPage };
};

const parseResourceFilter = (
  filter: ResourceCondition | null,
): ComparisonCondition | null => {
  if (filter == null) return null;

  if (filter.type === "comparison")
    return filter.conditions.length > 0 ? filter : null;

  return {
    type: "comparison",
    operator: "and",
    not: false,
    conditions: [filter],
  };
};

const getResourceFilterFromDropdownChange = (
  resourceFilter: ComparisonCondition | null,
  value: string,
  type: ResourceFilterType.Kind | ResourceFilterType.Version,
): ComparisonCondition | null => {
  if (value === "all") {
    if (resourceFilter == null) return null;

    const conditionsExcludingType = resourceFilter.conditions.filter(
      (c) => c.type !== type,
    );

    return { ...resourceFilter, conditions: conditionsExcludingType };
  }

  const condition: ResourceCondition = {
    type,
    operator: ResourceOperator.Equals,
    value,
  };

  if (resourceFilter == null) {
    return {
      type: FilterType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [condition],
    };
  }

  const conditionsExcludingType = resourceFilter.conditions.filter(
    (c) => c.type !== type,
  );

  const newResourceFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    not: false,
    conditions: [...conditionsExcludingType, condition],
  };

  return parseResourceFilter(newResourceFilter);
};

export const ResourcesPageContent: React.FC<{
  environment: SCHEMA.Environment;
  workspaceId: string;
}> = ({ environment, workspaceId }) => {
  const allResourcesQ = api.resource.byWorkspaceId.list.useQuery({
    workspaceId,
    filter: environment.resourceFilter ?? undefined,
    limit: 0,
  });

  const totalResources = allResourcesQ.data?.total ?? 0;

  const { page, setPage } = usePagination(totalResources);

  const hasPreviousPage = page > 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < totalResources;

  const [selectedView, setSelectedView] = useState("grid");
  const [resourceFilter, setResourceFilter] =
    useState<ComparisonCondition | null>(null);

  const finalFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    not: false,
    conditions: [environment.resourceFilter, resourceFilter].filter(isPresent),
  };

  const { resources, isLoading } = useFilteredResources(
    workspaceId,
    finalFilter,
    PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const handleFilterDropdownChange = (
    value: string,
    type: ResourceFilterType.Kind | ResourceFilterType.Version,
  ) => {
    const newResourceFilter = getResourceFilterFromDropdownChange(
      resourceFilter,
      value,
      type,
    );
    setResourceFilter(parseResourceFilter(newResourceFilter));
  };

  // Group resources by component
  const resourcesByVersion = _(resources)
    .groupBy((t) => t.version)
    .value() as Record<string, typeof resources>;
  const resourcesByKind = _(resources)
    .groupBy((t) => t.version + ": " + t.kind)
    .value() as Record<string, typeof resources>;

  const filteredResources = resources;

  return (
    <div className="space-y-6">
      {/* Resource Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 text-xs text-neutral-400">Total Resources</div>
          <div className="text-2xl font-semibold text-neutral-100">
            {resources.length}
          </div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-neutral-400">
              Across {Object.keys(resourcesByKind).length} kinds
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span>Healthy</span>
          </div>
          <div className="text-2xl font-semibold text-green-400">10</div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-green-400">{10}% of resources</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
            <span>Needs Attention</span>
          </div>
          <div className="text-2xl font-semibold text-amber-400">{0}</div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-amber-400">
              {0 > 0 ? "Action required" : "No issues detected"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span>Deploying</span>
          </div>
          <div className="text-2xl font-semibold text-blue-400">{0 + 0}</div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-blue-400">
              {0 > 0 ? "Updates in progress" : "No active deployments"}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            className="w-full pl-8 md:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResourceConditionDialog
            condition={resourceFilter}
            onChange={(condition) =>
              setResourceFilter(parseResourceFilter(condition))
            }
          >
            <Button
              variant="outline"
              // className="cursor-pointer transition-colors hover:bg-neutral-800/50"
            >
              <IconFilter className="mr-1 h-3.5 w-3.5" />
              {resourceFilter != null && resourceFilter.conditions.length > 0
                ? `Filter (${resourceFilter.conditions.length})`
                : "Filter"}
            </Button>
          </ResourceConditionDialog>

          <Select
            onValueChange={(value) => {
              if (value === "all") {
                handleFilterDropdownChange(value, ResourceFilterType.Kind);
                return;
              }

              const tokens = value.split(":");

              const kind = tokens.at(1);
              if (kind == null) return;
              const trimmedKind = kind.trim();
              if (trimmedKind.length === 0) return;

              handleFilterDropdownChange(trimmedKind, ResourceFilterType.Kind);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Kinds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Kinds</SelectItem>
              {Object.keys(resourcesByKind).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) =>
              handleFilterDropdownChange(value, ResourceFilterType.Version)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Versions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Versions</SelectItem>
              {Object.keys(resourcesByVersion).map((version) => (
                <SelectItem key={version} value={version}>
                  {version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="updating">Updating</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex">
            <Button
              variant="outline"
              onClick={() => setSelectedView("grid")}
              className={cn(
                "rounded-r-none",
                selectedView === "grid"
                  ? "bg-neutral-800"
                  : "hover:bg-neutral-800/50",
              )}
            >
              <IconGrid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedView("list")}
              className={cn(
                "rounded-l-none",
                selectedView === "list"
                  ? "bg-neutral-800"
                  : "hover:bg-neutral-800/50",
              )}
            >
              <IconList className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Resource Content */}
      {selectedView === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!isLoading &&
            filteredResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          {isLoading &&
            Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-[196px] w-full" />
            ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-800 hover:bg-transparent">
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Name
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Kind
                </TableHead>
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Component
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Provider
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Region
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Success Rate
                </TableHead>
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Last Updated
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => (
                <TableRow
                  key={resource.id}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/20"
                >
                  <TableCell className="py-3 font-medium text-neutral-200">
                    {resource.name}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.kind}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.version}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.providerId}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.providerId}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-neutral-800">
                        <div className={`h-full rounded-full bg-green-500`} />
                      </div>
                      <span className="text-sm">100%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-neutral-400">
                    {resource.updatedAt?.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={`bg-green-500/10 text-green-400`}
                      // className={
                      //   resource.status === "healthy"
                      //     ? "border-green-500/30 bg-green-500/10 text-green-400"
                      //     : resource.status === "degraded"
                      //       ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      //       : resource.status === "failed"
                      //         ? "border-red-500/30 bg-red-500/10 text-red-400"
                      //         : resource.status === "updating"
                      //           ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      //           : "border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
                      // }
                    >
                      Healthy
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
        <div>
          {resources.length === resources.length ? (
            <>Showing all {resources.length} resources</>
          ) : (
            <>
              Showing {resources.length} of {resources.length} resources
            </>
          )}
          {resourceFilter != null && resourceFilter.conditions.length > 0 && (
            <>
              {" "}
              • <span className="text-blue-400">Filtered</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={!hasPreviousPage}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
