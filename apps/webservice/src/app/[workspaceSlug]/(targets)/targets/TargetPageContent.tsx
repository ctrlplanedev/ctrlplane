"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import type {
  KindEqualsCondition,
  NameLikeCondition,
} from "@ctrlplane/validators/targets";
import React, { Fragment } from "react";
import { IconCategory, IconTag, IconTarget, IconX } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import type { TargetFilter } from "./TargetFilter";
import { api } from "~/trpc/react";
import { useFilters } from "../../_components/filter/Filter";
import { FilterDropdown } from "../../_components/filter/FilterDropdown";
import { NoFilterMatch } from "../../_components/filter/NoFilterMatch";
import { useTargetDrawer } from "../../_components/target-drawer/TargetDrawer";
import { KindFilterDialog } from "./KindFilterDialog";
import { MetadataFilterDialog } from "./MetadataFilterDialog";
import { NameFilterDialog } from "./NameFilterDialog";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

export const TargetPageContent: React.FC<{
  workspace: Workspace;
  kinds: string[];
}> = ({ workspace, kinds }) => {
  const { filters, removeFilter, addFilters, clearFilters, updateFilter } =
    useFilters<TargetFilter>();

  const targetsAll = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
  });

  const targets = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
    filters: filters.map((f) => f.value),
  });

  const { targetId, setTargetId } = useTargetDrawer();

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted />;
  return (
    <div className="h-full text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((f, idx) => (
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

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFilter(idx);
                      }}
                    >
                      <IconX />
                    </Button>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFilter(idx);
                      }}
                    >
                      <IconX />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFilter(idx);
                      }}
                    >
                      <IconX />
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
              <IconTarget /> Name
            </NameFilterDialog>
            <KindFilterDialog kinds={kinds}>
              <IconCategory /> Kind
            </KindFilterDialog>
            <MetadataFilterDialog workspaceId={workspace.id}>
              <IconTag /> Metadata
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
            onTableRowClick={(r) => setTargetId(r.id)}
          />
        </div>
      )}
    </div>
  );
};
