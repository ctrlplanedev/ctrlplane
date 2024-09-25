"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbTarget, TbX } from "react-icons/tb";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import type { SystemFilter } from "./SystemFilter";
import { api } from "~/trpc/react";
import { useFilters } from "../_components/filter/Filter";
import { FilterDropdown } from "../_components/filter/FilterDropdown";
import { ContentDialog } from "../_components/filter/FilterDropdownItems";
import { NoFilterMatch } from "../_components/filter/NoFilterMatch";
import { SystemsTable } from "./SystemsTable";

export const SystemsList: React.FC<{
  workspace: Workspace;
  systemsCount: number;
}> = ({ workspace, systemsCount }) => {
  const { filters, addFilters, removeFilter, clearFilters } =
    useFilters<SystemFilter>();

  const systems = api.system.list.useQuery({
    workspaceId: workspace.id,
    filters,
  });
  return (
    <div className="h-full">
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((f, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="text-sx h-7 gap-1.5 bg-neutral-900 pl-2 pr-1 font-normal"
            >
              <span>{capitalCase(f.key)}</span>
              <span className="text-muted-foreground">
                {f.key === "name" && "contains"}
                {f.key === "slug" && "contains"}
              </span>
              <span>
                {typeof f.value === "string" ? (
                  f.value
                ) : (
                  <HoverCard>
                    <HoverCardTrigger>
                      {Object.entries(f.value).length} metadata
                    </HoverCardTrigger>
                    <HoverCardContent className="p-2" align="start">
                      {Object.entries(f.value).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-red-400">{key}:</span>{" "}
                          <span className="text-green-400">
                            {value as string}
                          </span>
                        </div>
                      ))}
                    </HoverCardContent>
                  </HoverCard>
                )}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-xs text-muted-foreground"
                onClick={() => removeFilter(idx)}
              >
                <TbX />
              </Button>
            </Badge>
          ))}

          <FilterDropdown<SystemFilter>
            filters={filters}
            addFilters={addFilters}
            className="min-w-[200px] bg-neutral-900 p-1"
          >
            <ContentDialog<SystemFilter> property="name">
              <TbTarget /> Name
            </ContentDialog>
          </FilterDropdown>
        </div>

        {systems.data?.total != null && (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
            Total:
            <Badge
              variant="outline"
              className="rounded-full border-neutral-800 text-inherit"
            >
              {systems.data.total}
            </Badge>
          </div>
        )}
      </div>

      {systems.isLoading && (
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

      {systems.isSuccess && systems.data.total === 0 && (
        <NoFilterMatch
          numItems={systemsCount}
          itemType="system"
          onClear={clearFilters}
        />
      )}

      {systems.data != null && systems.data.total > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-90px)] overflow-auto">
          <SystemsTable
            systems={systems.data.items}
            workspaceSlug={workspace.slug}
          />
        </div>
      )}
    </div>
  );
};
