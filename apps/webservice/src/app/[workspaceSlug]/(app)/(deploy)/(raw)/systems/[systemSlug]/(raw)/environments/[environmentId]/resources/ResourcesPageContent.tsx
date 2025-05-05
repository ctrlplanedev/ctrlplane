"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import React, { useState } from "react";
import {
  IconFilter,
  IconGrid3x3,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import _ from "lodash";
import { useDebounce } from "react-use";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
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
  ColumnOperator,
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  ResourceConditionType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { ResourceConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionDialog";
import { usePagination } from "~/app/[workspaceSlug]/(app)/_hooks/usePagination";
import { EditSelector } from "./_components/EditSelector";
import { ResourceCard } from "./_components/ResourceCard";
import { ResourceTable } from "./_components/ResourceTable";
import { useFilteredResources } from "./_hooks/useFilteredResources";

const PAGE_SIZE = 16;

const parseResourceSelector = (
  selector: ResourceCondition | null,
): ComparisonCondition | null => {
  if (selector == null) return null;

  if (selector.type === "comparison")
    return selector.conditions.length > 0 ? selector : null;

  return {
    type: "comparison",
    operator: "and",
    not: false,
    conditions: [selector],
  };
};

const getResourceFilterFromDropdownChange = (
  resourceFilter: ComparisonCondition | null,
  value: string,
  type: ResourceConditionType.Kind | ResourceConditionType.Version,
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
      type: ConditionType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [condition],
    };
  }

  const conditionsExcludingType = resourceFilter.conditions.filter(
    (c) => c.type !== type,
  );

  const newResourceFilter: ResourceCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    not: false,
    conditions: [...conditionsExcludingType, condition],
  };

  return parseResourceSelector(newResourceFilter);
};

const getResourceFilterWithSearch = (
  resourceFilter: ComparisonCondition | null,
  searchTerm: string,
): ComparisonCondition | null => {
  if (searchTerm.length === 0) {
    if (resourceFilter == null) return null;

    const conditionsExcludingSearch = resourceFilter.conditions.filter(
      (c) => c.type !== ResourceConditionType.Name,
    );

    return parseResourceSelector({
      ...resourceFilter,
      conditions: conditionsExcludingSearch,
    });
  }

  const newNameCondition: ResourceCondition = {
    type: ResourceConditionType.Name,
    operator: ColumnOperator.Contains,
    value: searchTerm,
  };

  if (resourceFilter == null) {
    return parseResourceSelector({
      type: ConditionType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [newNameCondition],
    });
  }

  const conditionsExcludingSearch = resourceFilter.conditions.filter(
    (c) => c.type !== ResourceConditionType.Name,
  );

  return parseResourceSelector({
    ...resourceFilter,
    conditions: [...conditionsExcludingSearch, newNameCondition],
  });
};

export const ResourcesPageContent: React.FC<{
  environment: SCHEMA.Environment;
  workspaceId: string;
}> = ({ environment, workspaceId }) => {
  const allResourcesQ = useFilteredResources(
    workspaceId,
    environment.id,
    environment.resourceSelector,
  );

  const totalResources = allResourcesQ.resources.length;
  const healthyResources = allResourcesQ.resources.filter(
    (r) => r.successRate > 99.9999,
  ).length;
  const healthyPercentage =
    totalResources > 0 ? (healthyResources / totalResources) * 100 : 0;
  const unhealthyResources = allResourcesQ.resources.filter(
    (r) => r.successRate <= 99.9999,
  ).length;
  const deployingResources = allResourcesQ.resources.filter(
    (r) => r.isDeploying,
  ).length;

  const { page, setPage } = usePagination(totalResources, PAGE_SIZE);

  const hasPreviousPage = page > 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < totalResources;

  const [selectedView, setSelectedView] = useState("grid");
  const [resourceFilter, setResourceFilter] =
    useState<ComparisonCondition | null>(null);

  const finalFilter: ResourceCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    not: false,
    conditions: [environment.resourceSelector, resourceFilter].filter(
      isPresent,
    ),
  };

  const { resources, isLoading } = useFilteredResources(
    workspaceId,
    environment.id,
    finalFilter,
    PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const handleFilterDropdownChange = (
    value: string,
    type: ResourceConditionType.Kind | ResourceConditionType.Version,
  ) => {
    const newResourceFilter = getResourceFilterFromDropdownChange(
      resourceFilter,
      value,
      type,
    );
    setResourceFilter(parseResourceSelector(newResourceFilter));
  };

  const [search, setSearch] = useState("");

  useDebounce(
    () => {
      setResourceFilter(getResourceFilterWithSearch(resourceFilter, search));
    },
    500,
    [search],
  );

  // Group resources by component
  const resourcesByVersion = _(resources)
    .groupBy((t) => t.version)
    .value() as Record<string, typeof resources>;
  const resourcesByKind = _(resources)
    .groupBy((t) => t.version + ": " + t.kind)
    .value() as Record<string, typeof resources>;

  if (environment.resourceSelector == null)
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Resources</CardTitle>
            <CardDescription>
              Resources managed in this environment
            </CardDescription>
          </div>
          <EditSelector environment={environment} resources={resources} />
        </CardHeader>
        <CardContent>
          <p>No resource filter set for this environment</p>
        </CardContent>
      </Card>
    );

  const formattedResources = resources.map((r) => {
    if (r.isDeploying) return { ...r, status: "deploying" as const };
    if (r.successRate > 99.9999) return { ...r, status: "healthy" as const };
    return { ...r, status: "unhealthy" as const };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Resources managed in this environment
          </CardDescription>
        </div>
        <EditSelector environment={environment} resources={resources} />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Resource Summary Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-1 text-xs text-neutral-400">
                Total Resources
              </div>
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
              <div className="text-2xl font-semibold text-green-400">
                {healthyResources}
              </div>
              <div className="mt-1 flex items-center text-xs">
                <span className="text-green-400">
                  {Number(healthyPercentage).toFixed(0)}% of resources
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span>Unhealthy</span>
              </div>
              <div className="text-2xl font-semibold text-red-400">
                {unhealthyResources}
              </div>
              <div className="mt-1 flex items-center text-xs">
                <span className="text-red-400">
                  {unhealthyResources > 0
                    ? "Action required"
                    : "No issues detected"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>Deploying</span>
              </div>
              <div className="text-2xl font-semibold text-blue-400">
                {deployingResources}
              </div>
              <div className="mt-1 flex items-center text-xs">
                <span className="text-blue-400">
                  {deployingResources > 0
                    ? "Updates in progress"
                    : "No active deployments"}
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ResourceConditionDialog
                condition={resourceFilter}
                onChange={(condition) =>
                  setResourceFilter(parseResourceSelector(condition))
                }
              >
                <Button variant="outline">
                  <IconFilter className="mr-1 h-3.5 w-3.5" />
                  {resourceFilter != null &&
                  resourceFilter.conditions.length > 0
                    ? `Filter (${resourceFilter.conditions.length})`
                    : "Filter"}
                </Button>
              </ResourceConditionDialog>

              <Select
                onValueChange={(value) => {
                  if (value === "all") {
                    handleFilterDropdownChange(
                      value,
                      ResourceConditionType.Kind,
                    );
                    return;
                  }

                  const tokens = value.split(":");

                  const kind = tokens.at(1);
                  if (kind == null) return;
                  const trimmedKind = kind.trim();
                  if (trimmedKind.length === 0) return;

                  handleFilterDropdownChange(
                    trimmedKind,
                    ResourceConditionType.Kind,
                  );
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
                  handleFilterDropdownChange(
                    value,
                    ResourceConditionType.Version,
                  )
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
          {selectedView === "grid" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {!isLoading &&
                formattedResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              {isLoading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-[196px] w-full" />
                ))}
            </div>
          )}
          {selectedView === "list" && (
            <ResourceTable resources={formattedResources} />
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
            <div>
              {totalResources === resources.length ? (
                <>Showing all {resources.length} resources</>
              ) : (
                <>
                  Showing {resources.length} of {totalResources} resources
                </>
              )}
              {resourceFilter != null &&
                resourceFilter.conditions.length > 0 && (
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
      </CardContent>
    </Card>
  );
};
