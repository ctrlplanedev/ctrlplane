"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useEffect } from "react";
import {
  IconDots,
  IconDownload,
  IconFilter,
  IconLoader2,
  IconSearch,
} from "@tabler/icons-react";
import range from "lodash/range";
import { useDebounce, useKey } from "react-use";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import {
  defaultCondition,
  isEmptyCondition,
} from "@ctrlplane/validators/resources";

import { NoFilterMatch } from "~/app/[workspaceSlug]/(app)/_components/filter/NoFilterMatch";
import { TargetConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/target-condition/TargetConditionBadge";
import {
  CreateTargetViewDialog,
  TargetConditionDialog,
} from "~/app/[workspaceSlug]/(app)/_components/target-condition/TargetConditionDialog";
import { TargetViewActionsDropdown } from "~/app/[workspaceSlug]/(app)/_components/target-condition/TargetViewActionsDropdown";
import { useTargetFilter } from "~/app/[workspaceSlug]/(app)/_components/target-condition/useTargetFilter";
import { useTargetDrawer } from "~/app/[workspaceSlug]/(app)/_components/target-drawer/useTargetDrawer";
import { api } from "~/trpc/react";
import { exportResources } from "./exportResources";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

export const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  useKey("Escape", () => setIsExpanded(false));

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsExpanded((e) => !e)}
        className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
      >
        <IconSearch className="h-4 w-4" />
      </Button>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        ref={inputRef}
        type="text"
        className={`bg-transparent outline-none transition-all duration-200 ${
          isExpanded ? "w-[150px] pl-1" : "w-0"
        }`}
        placeholder="Search..."
        onBlur={() => setIsExpanded(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setIsExpanded(false);
        }}
      />
    </div>
  );
};

export const TargetPageContent: React.FC<{
  workspace: schema.Workspace;
  view: schema.ResourceView | null;
}> = ({ workspace, view }) => {
  const [search, setSearch] = React.useState("");
  const { filter, setFilter } = useTargetFilter();

  useDebounce(
    () => {
      if (search === "") return;
      setFilter({
        type: "comparison",
        operator: "and",
        conditions: [
          // Keep any non-name conditions from existing filter
          ...(filter && "conditions" in filter
            ? filter.conditions.filter(
                (c: ResourceCondition) => c.type !== "name",
              )
            : []),
          {
            type: "name",
            operator: ColumnOperator.Contains,
            value: search,
          },
        ],
      });
    },
    500,
    [search],
  );

  const workspaceId = workspace.id;
  const targetsAll = api.resource.byWorkspaceId.list.useQuery({
    workspaceId,
    limit: 0,
  });
  const targets = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId, filter: filter ?? undefined, limit: 500 },
    { placeholderData: (prev) => prev },
  );

  const onFilterChange = (condition: ResourceCondition | null) => {
    const cond = condition ?? defaultCondition;
    if (isEmptyCondition(cond)) setFilter(null);
    if (!isEmptyCondition(cond)) setFilter(cond);
  };

  const { targetId, setTargetId } = useTargetDrawer();

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted workspace={workspace} />;

  return (
    <div className="h-full text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex items-center gap-1 pl-1">
          <SearchInput value={search} onChange={setSearch} />
          <TargetConditionDialog condition={filter} onChange={onFilterChange}>
            <div className="flex items-center gap-2">
              {view == null && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
                >
                  <IconFilter className="h-4 w-4" />
                </Button>
              )}

              {filter != null && view == null && (
                <TargetConditionBadge condition={filter} />
              )}
              {view != null && (
                <>
                  <span>{view.name}</span>
                  <TargetViewActionsDropdown view={view}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
                    >
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </TargetViewActionsDropdown>
                </>
              )}
            </div>
          </TargetConditionDialog>
          {!targets.isLoading && targets.isFetching && (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {filter != null && view == null && (
            <CreateTargetViewDialog
              workspaceId={workspace.id}
              filter={filter}
              onSubmit={(v) => setFilter(v.filter, v.id)}
            >
              <Button className="h-7">Save view</Button>
            </CreateTargetViewDialog>
          )}
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
          {targets.data != null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportResources(targets.data.items)}
              className="flex items-center gap-2"
            >
              Export CSV
              <IconDownload className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {targets.isLoading && (
        <div className="space-y-2 p-4">
          {range(10).map((i) => (
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
          onClear={() => setFilter(null)}
        />
      )}
      {targets.data != null && targets.data.total > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-90px)] overflow-auto">
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
