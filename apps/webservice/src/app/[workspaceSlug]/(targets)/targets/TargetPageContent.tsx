"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import type {
  ComparisonCondition,
  KindEqualsCondition,
  NameLikeCondition,
} from "@ctrlplane/validators/targets";
import React, { Fragment, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbCategory, TbTag, TbTarget, TbX } from "react-icons/tb";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import type { TargetFilter } from "./TargetFilter";
import { api } from "~/trpc/react";
import { useFilters } from "../../_components/filter/Filter";
import { FilterDropdown } from "../../_components/filter/FilterDropdown";
import { NoFilterMatch } from "../../_components/filter/NoFilterMatch";
import { KindFilterDialog } from "./KindFilterDialog";
import { MetadataFilterDialog } from "./MetadataFilterDialog";
import { NameFilterDialog } from "./NameFilterDialog";
import { TargetDrawer } from "./target-drawer/TargetDrawer";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

export const TargetPageContent: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const { filters, removeFilter, addFilters, clearFilters, updateFilter } =
    useFilters<TargetFilter>();
  const searchParams = useSearchParams();
  const filtersWithCombination = useMemo(() => {
    const combinations = searchParams.get("combinations");
    const parsed: Record<string, string | null> | null = combinations
      ? JSON.parse(combinations)
      : null;

    if (parsed == null) return filters;

    const combination: ComparisonCondition = {
      type: TargetFilterType.Comparison,
      operator: TargetOperator.And,
      conditions: Object.entries(parsed).map(([key, value]) => {
        return value == null
          ? {
              type: TargetFilterType.Metadata,
              operator: TargetOperator.Null,
              key,
            }
          : {
              type: TargetFilterType.Metadata,
              operator: TargetOperator.Equals,
              key,
              value,
            };
      }),
    };

    return [{ key: "metadata", value: combination }, ...filters];
  }, [searchParams, filters]);

  const targetsAll = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
  });

  const targets = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
    filters: filtersWithCombination.map((f) => f.value),
  });
  const kinds = _.uniq((targets.data?.items ?? []).map((t) => t.kind));

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const targetId = selectedTargetId ?? targets.data?.items.at(0)?.id;

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted />;
  return (
    <div className="h-full text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex flex-wrap items-center gap-1">
          {filtersWithCombination.map((f, idx) => (
            <Fragment key={idx}>
              {f.key === "metadata" ? (
                <MetadataFilterDialog
                  workspaceId={workspace.id}
                  filter={f.value}
                  onChange={(filter: TargetFilter) => updateFilter(idx, filter)}
                >
                  <Badge
                    key={idx}
                    variant="outline"
                    className="h-7 cursor-pointer gap-1.5 bg-neutral-900 pl-2 pr-1 text-xs font-normal"
                  >
                    <span>{capitalCase(f.key)}</span>
                    <span className="text-muted-foreground">matches</span>
                    <span>
                      {f.value.conditions.length}
                      {f.value.conditions.length > 1 ? " keys" : " key"}
                    </span>
                    {(idx !== 0 || !searchParams.get("combinations")) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-xs text-muted-foreground"
                        onClick={() => removeFilter(idx)}
                      >
                        <TbX />
                      </Button>
                    )}
                  </Badge>
                </MetadataFilterDialog>
              ) : f.key === "kind" ? (
                <KindFilterDialog
                  kinds={kinds}
                  filter={f.value}
                  onChange={(filter: TargetFilter) => updateFilter(idx, filter)}
                >
                  <Badge
                    key={idx}
                    variant="outline"
                    className="h-7 cursor-pointer gap-1.5 bg-neutral-900 pl-2 pr-1 text-xs font-normal"
                  >
                    {f.value.conditions.length === 1 ? (
                      <>
                        <span>{capitalCase(f.key)}</span>
                        <span className="text-muted-foreground">is</span>
                        <span>
                          {
                            (f.value.conditions as KindEqualsCondition[]).at(0)
                              ?.value
                          }
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{capitalCase(f.key)}</span>
                        <span className="text-muted-foreground">is of</span>
                        <span>{f.value.conditions.length} options</span>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-xs text-muted-foreground"
                      onClick={() => removeFilter(idx)}
                    >
                      <TbX />
                    </Button>
                  </Badge>
                </KindFilterDialog>
              ) : (
                <NameFilterDialog
                  filter={f.value}
                  onChange={(filter: TargetFilter) => updateFilter(idx, filter)}
                >
                  <Badge
                    key={idx}
                    variant="outline"
                    className="h-7 cursor-pointer gap-1.5 bg-neutral-900 pl-2 pr-1 text-xs font-normal"
                  >
                    {f.value.conditions.length === 1 ? (
                      <>
                        <span>{capitalCase(f.key)}</span>
                        <span className="text-muted-foreground">conatins</span>
                        <span>
                          {(f.value.conditions as NameLikeCondition[])
                            .at(0)
                            ?.value.replace(/^%|%$/g, "")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{capitalCase(f.key)}</span>
                        <span className="text-muted-foreground">conatins</span>
                        <span>{f.value.conditions.length} strings</span>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-xs text-muted-foreground"
                      onClick={() => removeFilter(idx)}
                    >
                      <TbX />
                    </Button>
                  </Badge>
                </NameFilterDialog>
              )}
            </Fragment>
          ))}

          <FilterDropdown<TargetFilter>
            filters={filters}
            addFilters={addFilters}
            className="min-w-[200px] bg-neutral-900 p-1"
          >
            <NameFilterDialog>
              <TbTarget /> Name
            </NameFilterDialog>
            <KindFilterDialog kinds={kinds}>
              <TbCategory /> Kind
            </KindFilterDialog>
            <MetadataFilterDialog workspaceId={workspace.id}>
              <TbTag /> Metadata
            </MetadataFilterDialog>
          </FilterDropdown>
        </div>

        {targets.data?.total != null && (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {targets.data.total}
            </Badge>
          </div>
        )}
      </div>

      {targets.isLoading && (
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
      {targets.isSuccess && targets.data.total === 0 && (
        <NoFilterMatch
          numItems={targetsAll.data?.total ?? 0}
          itemType="target"
          onClear={clearFilters}
        />
      )}
      {targets.data != null && targets.data.total > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-90px)] overflow-auto">
          <TargetsTable
            targets={targets.data.items}
            activeTargetIds={targetId ? [targetId] : []}
            onTableRowClick={(r) => setSelectedTargetId(r.id)}
          />
        </div>
      )}
      <TargetDrawer
        isOpen={selectedTargetId != null}
        setIsOpen={() => setSelectedTargetId(null)}
        targetId={targetId}
      />
    </div>
  );
};
