"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
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
  isComparisonCondition,
  isEmptyCondition,
} from "@ctrlplane/validators/resources";

import { NoFilterMatch } from "~/app/[workspaceSlug]/(app)/_components/filter/NoFilterMatch";
import { ResourceConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionBadge";
import {
  CreateResourceViewDialog,
  ResourceConditionDialog,
} from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionDialog";
import { ResourceViewActionsDropdown } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceViewActionsDropdown";
import { useResourceCondition } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/useResourceCondition";
import { api } from "~/trpc/react";
import { exportResources } from "./export-resources";
import { ResourceGettingStarted } from "./ResourceGettingStarted";
import { ResourcesTable } from "./ResourcesTable";

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

export const ResourcePageContent: React.FC<{
  workspace: schema.Workspace;
  view: schema.ResourceView | null;
}> = ({ workspace, view }) => {
  const [search, setSearch] = React.useState("");
  const { condition, setCondition } = useResourceCondition();

  useDebounce(
    () => {
      if (search !== "") {
        setCondition({
          type: "comparison",
          operator: "and",
          conditions: [
            // Keep any non-name conditions from existing filter
            ...(condition && "conditions" in condition
              ? condition.conditions.filter(
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
        return;
      }

      if (condition == null || !isComparisonCondition(condition)) return;
      const otherConditions = condition.conditions.filter(
        (c: ResourceCondition) => c.type !== "name",
      );
      setCondition(
        otherConditions.length === 0
          ? null
          : { ...condition, conditions: otherConditions },
      );
    },
    500,
    [search],
  );

  const workspaceId = workspace.id;
  const resourcesAll = api.resource.byWorkspaceId.list.useQuery({
    workspaceId,
    limit: 0,
  });
  const resources = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId, filter: condition ?? undefined, limit: 500 },
    { placeholderData: (prev) => prev },
  );

  const onConditionChange = (condition: ResourceCondition | null) => {
    const cond = condition ?? defaultCondition;
    setCondition(isEmptyCondition(cond) ? null : cond);
  };

  const router = useRouter();

  if (resourcesAll.isSuccess && resourcesAll.data.total === 0)
    return <ResourceGettingStarted workspace={workspace} />;

  return (
    <div className="text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex items-center gap-1 pl-1">
          <SearchInput value={search} onChange={setSearch} />
          <ResourceConditionDialog
            condition={condition}
            onChange={onConditionChange}
          >
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

              {condition != null && view == null && (
                <ResourceConditionBadge condition={condition} />
              )}
              {view != null && (
                <>
                  <span>{view.name}</span>
                  <ResourceViewActionsDropdown view={view}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
                    >
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </ResourceViewActionsDropdown>
                </>
              )}
            </div>
          </ResourceConditionDialog>
          {!resources.isLoading && resources.isFetching && (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {condition != null && view == null && (
            <CreateResourceViewDialog
              workspaceId={workspace.id}
              filter={condition}
              onSubmit={(v) => setCondition(v.filter, v.id)}
            >
              <Button className="h-7">Save view</Button>
            </CreateResourceViewDialog>
          )}
          {resources.data?.total != null && (
            <div className="flex items-center gap-2 rounded-lg border border-neutral-800/50 px-2 py-1 text-sm text-muted-foreground">
              Total:
              <Badge
                variant="outline"
                className="rounded-full border-neutral-800 text-inherit"
              >
                {resources.data.total}
              </Badge>
            </div>
          )}
          {resources.data != null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportResources(resources.data.items)}
              className="flex items-center gap-2"
            >
              Export CSV
              <IconDownload className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {resources.isLoading && (
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
      {resources.isSuccess && resources.data.total === 0 && (
        <NoFilterMatch
          numItems={resourcesAll.data?.total ?? 0}
          itemType="resource"
          onClear={() => setCondition(null)}
        />
      )}
      {resources.data != null && resources.data.total > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto">
          <ResourcesTable
            resources={resources.data.items}
            onTableRowClick={(r) =>
              router.push(`/${workspace.slug}/resources/${r.id}`)
            }
          />
        </div>
      )}
    </div>
  );
};
