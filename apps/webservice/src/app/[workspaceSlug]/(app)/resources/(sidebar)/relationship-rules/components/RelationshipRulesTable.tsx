"use client";

import { useState } from "react";
import {
  IconArrowRight,
  IconArrowsLeftRight,
  IconChevronDown,
  IconChevronRight,
  IconCircleDot,
  IconDatabase,
  IconEqual,
  IconFilter,
  IconGitBranch,
  IconLink,
  IconSearch,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { noCase } from "change-case";
import { useDebounce } from "react-use";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent } from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { CreateRelationshipDialog } from "./CreateRelationshipDialog";
import { RelationshipRuleDropdown } from "./RelationshipRuleDropdown";

interface RelationshipRulesTableProps {
  workspaceId: string;
}

const getDependencyTypeColor = (type: string) => {
  switch (type) {
    case "depends_on":
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    case "blocks":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "uses":
      return "text-green-400 bg-green-500/10 border-green-500/20";
    case "provides":
      return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    default:
      return "text-muted-foreground bg-muted/50 border-border";
  }
};

const getDependencyTypeIcon = (type: string) => {
  switch (type) {
    case "depends_on":
      return IconArrowRight;
    case "blocks":
      return IconX;
    case "uses":
      return IconLink;
    case "provides":
      return IconCircleDot;
    default:
      return IconGitBranch;
  }
};

export const RelationshipRulesTable: React.FC<RelationshipRulesTableProps> = ({
  workspaceId,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dependencyTypeFilter, setDependencyTypeFilter] =
    useState<string>("all");
  const [sourceKindFilter, setSourceKindFilter] = useState<string>("all");
  const [targetKindFilter, setTargetKindFilter] = useState<string>("all");

  // Collapse state management
  const [collapsedReferences, setCollapsedReferences] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  useDebounce(() => setDebouncedSearch(search), 300, [search]);

  const rules = api.resource.relationshipRules.list.useQuery(workspaceId);

  // Extract unique values for filters
  const dependencyTypes = Array.from(
    new Set(rules.data?.map((rule) => rule.dependencyType) ?? []),
  );
  const sourceKinds = Array.from(
    new Set(rules.data?.map((rule) => rule.sourceKind) ?? []),
  );
  const targetKinds = Array.from(
    new Set(rules.data?.map((rule) => rule.targetKind).filter(Boolean) ?? []),
  );

  // Filter rules based on search and filters
  const filteredRules =
    rules.data?.filter((rule) => {
      const matchesSearch =
        (rule.reference.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          rule.sourceKind
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase()) ||
          rule.targetKind
            ?.toLowerCase()
            .includes(debouncedSearch.toLowerCase())) ??
        (rule.sourceVersion
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase()) ||
          rule.targetVersion
            ?.toLowerCase()
            .includes(debouncedSearch.toLowerCase())) ??
        (rule.dependencyDescription ?? noCase(rule.dependencyType))
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase());

      const matchesDependencyType =
        dependencyTypeFilter === "all" ||
        rule.dependencyType === dependencyTypeFilter;

      const matchesSourceKind =
        sourceKindFilter === "all" || rule.sourceKind === sourceKindFilter;

      const matchesTargetKind =
        targetKindFilter === "all" || rule.targetKind === targetKindFilter;

      return (
        matchesSearch &&
        matchesDependencyType &&
        matchesSourceKind &&
        matchesTargetKind
      );
    }) ?? [];

  // Group rules by reference name, then by source kind
  const groupedRules = filteredRules.reduce(
    (acc, rule) => {
      if (!acc[rule.reference]) {
        acc[rule.reference] = {};
      }

      const refGroup = acc[rule.reference];
      if (!refGroup) return acc;

      // Create a secondary grouping key based on source kind only
      const secondaryKey = rule.sourceKind;

      if (!refGroup[secondaryKey]) {
        refGroup[secondaryKey] = [];
      }

      refGroup[secondaryKey].push(rule);
      return acc;
    },
    {} as Record<string, Record<string, typeof filteredRules>>,
  );

  // Sort reference names alphabetically
  const sortedReferences = Object.keys(groupedRules).sort();

  // Initialize collapsed state for all references (start collapsed)
  useState(() => {
    const allReferences = new Set(sortedReferences);
    setCollapsedReferences(allReferences);

    // Also collapse all secondary groups by default
    const allGroups = new Set<string>();
    sortedReferences.forEach((ref) => {
      const refGroups = groupedRules[ref];
      if (refGroups) {
        Object.keys(refGroups).forEach((groupKey) => {
          allGroups.add(`${ref}:${groupKey}`);
        });
      }
    });
    setCollapsedGroups(allGroups);
  });

  const hasActiveFilters =
    dependencyTypeFilter !== "all" ||
    sourceKindFilter !== "all" ||
    targetKindFilter !== "all";

  const clearFilters = () => {
    setDependencyTypeFilter("all");
    setSourceKindFilter("all");
    setTargetKindFilter("all");
    setSearch("");
  };

  const toggleReference = (reference: string) => {
    setCollapsedReferences((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reference)) {
        newSet.delete(reference);
      } else {
        newSet.add(reference);
      }
      return newSet;
    });
  };

  const toggleGroup = (reference: string, groupKey: string) => {
    const fullKey = `${reference}:${groupKey}`;
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fullKey)) {
        newSet.delete(fullKey);
      } else {
        newSet.add(fullKey);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setCollapsedReferences(new Set());
    setCollapsedGroups(new Set());
  };

  const collapseAll = () => {
    setCollapsedReferences(new Set(sortedReferences));
    const allGroups = new Set<string>();
    sortedReferences.forEach((ref) => {
      const refGroups = groupedRules[ref];
      if (refGroups) {
        Object.keys(refGroups).forEach((groupKey) => {
          allGroups.add(`${ref}:${groupKey}`);
        });
      }
    });
    setCollapsedGroups(allGroups);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Relationship Rules</h2>
          <p className="text-sm text-muted-foreground">
            Define how resources are related to each other across your systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="h-6 px-2 text-xs"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="h-6 px-2 text-xs"
          >
            Collapse All
          </Button>
          <CreateRelationshipDialog workspaceId={workspaceId} />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[300px] flex-1">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference, source, target, version, or dependency type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <IconFilter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filters:</span>
        </div>

        <Select
          value={dependencyTypeFilter}
          onValueChange={setDependencyTypeFilter}
        >
          <SelectTrigger className="h-7 w-[160px]">
            <SelectValue placeholder="Dependency Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dependency Types</SelectItem>
            {dependencyTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {noCase(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceKindFilter} onValueChange={setSourceKindFilter}>
          <SelectTrigger className="h-7 w-[120px]">
            <SelectValue placeholder="Source Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Source Kinds</SelectItem>
            {sourceKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={targetKindFilter} onValueChange={setTargetKindFilter}>
          <SelectTrigger className="h-7 w-[120px]">
            <SelectValue placeholder="Target Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Target Kinds</SelectItem>
            {targetKinds.map((kind) => (
              <SelectItem key={kind} value={kind ?? ""}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            <IconX className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {rules.isLoading ? (
            "Loading..."
          ) : (
            <>
              {filteredRules.length} rules in {sortedReferences.length}{" "}
              references
              {debouncedSearch && <span> for "{debouncedSearch}"</span>}
            </>
          )}
        </span>
      </div>

      {/* Grouped Rules */}
      {rules.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedReferences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <p className="text-sm text-muted-foreground">
              {debouncedSearch || hasActiveFilters
                ? "No relationship rules match your search criteria."
                : "No relationship rules found."}
            </p>
            {(debouncedSearch || hasActiveFilters) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mt-2 h-6 text-xs"
              >
                Clear search and filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedReferences.map((reference) => {
            const isReferenceCollapsed = collapsedReferences.has(reference);
            const referenceGroups = groupedRules[reference];

            if (!referenceGroups) return null;

            const sortedGroupKeys = Object.keys(referenceGroups).sort();
            const totalRulesInReference =
              Object.values(referenceGroups).flat().length;

            return (
              <Card key={reference}>
                <CardContent className="p-0">
                  {/* Reference Header */}
                  <div
                    className="flex cursor-pointer items-center gap-2 p-3 transition-colors hover:bg-muted/30"
                    onClick={() => toggleReference(reference)}
                  >
                    {isReferenceCollapsed ? (
                      <IconChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <IconChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <IconTag className="h-4 w-4 flex-shrink-0 text-blue-400" />
                    <h3 className="flex-1 text-sm font-semibold">
                      {reference}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0.5 text-xs"
                    >
                      {totalRulesInReference}
                    </Badge>
                  </div>

                  {/* Reference Content */}
                  {!isReferenceCollapsed && (
                    <div className="border-t border-border">
                      {sortedGroupKeys.map((groupKey) => {
                        const rulesInGroup = referenceGroups[groupKey];
                        if (!rulesInGroup) return null;

                        const isGroupCollapsed = collapsedGroups.has(
                          `${reference}:${groupKey}`,
                        );

                        return (
                          <div
                            key={groupKey}
                            className="border-b border-border last:border-b-0"
                          >
                            {/* Group Header */}
                            <div
                              className="flex cursor-pointer items-center gap-2 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                              onClick={() => toggleGroup(reference, groupKey)}
                            >
                              {isGroupCollapsed ? (
                                <IconChevronRight className="ml-1 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                              ) : (
                                <IconChevronDown className="ml-1 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                              )}
                              <span className="flex-1 text-sm font-medium">
                                {groupKey}
                              </span>
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0.5 text-xs"
                              >
                                {rulesInGroup.length}
                              </Badge>
                            </div>

                            {/* Group Content */}
                            {!isGroupCollapsed && (
                              <div className="divide-y divide-border">
                                {rulesInGroup.map((rule) => {
                                  const DependencyIcon = getDependencyTypeIcon(
                                    rule.dependencyType,
                                  );
                                  const dependencyColorClass =
                                    getDependencyTypeColor(rule.dependencyType);

                                  return (
                                    <div
                                      key={rule.id}
                                      className="p-3 transition-colors hover:bg-muted/10"
                                    >
                                      {/* Rule Header */}
                                      <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${dependencyColorClass}`}
                                          >
                                            <DependencyIcon className="h-3 w-3" />
                                            <span className="font-medium">
                                              {rule.dependencyDescription ??
                                                noCase(rule.dependencyType)}
                                            </span>
                                          </div>

                                          {/* Source & Target in header */}
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5">
                                              <Badge
                                                variant="outline"
                                                className="px-1.5 py-0.5 text-xs"
                                              >
                                                <IconDatabase className="mr-1 h-3 w-3" />
                                                {rule.sourceKind}
                                              </Badge>
                                              <Badge
                                                variant="secondary"
                                                className="font-mono text-xs"
                                              >
                                                {rule.sourceVersion}
                                              </Badge>
                                            </div>
                                            <IconArrowRight className="h-3 w-3 text-muted-foreground" />
                                            <div className="flex items-center gap-1.5">
                                              <Badge
                                                variant="outline"
                                                className="px-1.5 py-0.5 text-xs"
                                              >
                                                <IconDatabase className="mr-1 h-3 w-3" />
                                                {rule.targetKind}
                                              </Badge>
                                              <Badge
                                                variant="secondary"
                                                className="font-mono text-xs"
                                              >
                                                {rule.targetVersion ?? "any"}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                        <RelationshipRuleDropdown rule={rule} />
                                      </div>

                                      {/* Rule Content - Only show if there are additional details */}
                                      {(rule.metadataKeysMatches.length > 0 ||
                                        rule.sourceMetadataEquals.length > 0 ||
                                        rule.targetMetadataEquals.length >
                                          0) && (
                                        <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-2 xl:grid-cols-3">
                                          {/* Metadata Matches */}
                                          {rule.metadataKeysMatches.length >
                                            0 && (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-1.5">
                                                <IconArrowsLeftRight className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs font-medium text-muted-foreground">
                                                  Matching
                                                </span>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {rule.metadataKeysMatches.map(
                                                  (match) => (
                                                    <div
                                                      key={`${match.sourceKey}-${match.targetKey}`}
                                                      className="flex items-center gap-1 rounded-md border border-green-500/20 bg-green-500/10 px-2 py-1"
                                                    >
                                                      <Badge
                                                        variant="secondary"
                                                        className="px-1 py-0.5 font-mono text-xs"
                                                      >
                                                        {match.sourceKey}
                                                      </Badge>
                                                      <IconArrowsLeftRight className="h-3 w-3 text-green-400" />
                                                      <Badge
                                                        variant="secondary"
                                                        className="px-1 py-0.5 font-mono text-xs"
                                                      >
                                                        {match.targetKey}
                                                      </Badge>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {/* Source Metadata Constraints */}
                                          {rule.sourceMetadataEquals.length >
                                            0 && (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-1.5">
                                                <IconEqual className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs font-medium text-blue-400">
                                                  Source Constraints
                                                </span>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {rule.sourceMetadataEquals.map(
                                                  (equals) => (
                                                    <Badge
                                                      key={equals.key}
                                                      variant="outline"
                                                      className="border-blue-500/20 bg-blue-500/10 px-1 py-0.5 font-mono text-xs"
                                                    >
                                                      {equals.key}:
                                                      {equals.value}
                                                    </Badge>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {/* Target Metadata Constraints */}
                                          {rule.targetMetadataEquals.length >
                                            0 && (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-1.5">
                                                <IconEqual className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs font-medium text-purple-400">
                                                  Target Constraints
                                                </span>
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {rule.targetMetadataEquals.map(
                                                  (equals) => (
                                                    <Badge
                                                      key={equals.key}
                                                      variant="outline"
                                                      className="border-purple-500/20 bg-purple-500/10 px-1 py-0.5 font-mono text-xs"
                                                    >
                                                      {equals.key}:
                                                      {equals.value}
                                                    </Badge>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
