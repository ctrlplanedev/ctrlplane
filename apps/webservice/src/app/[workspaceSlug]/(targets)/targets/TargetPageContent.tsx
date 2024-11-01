"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import React from "react";
import { IconDots, IconFilter, IconLoader2 } from "@tabler/icons-react";
import range from "lodash/range";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  defaultCondition,
  isEmptyCondition,
} from "@ctrlplane/validators/targets";

import { NoFilterMatch } from "~/app/[workspaceSlug]/_components/filter/NoFilterMatch";
import { TargetConditionBadge } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionBadge";
import {
  CreateTargetViewDialog,
  TargetConditionDialog,
} from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionDialog";
import { TargetViewActionsDropdown } from "~/app/[workspaceSlug]/_components/target-condition/TargetViewActionsDropdown";
import { useTargetFilter } from "~/app/[workspaceSlug]/_components/target-condition/useTargetFilter";
import { useTargetDrawer } from "~/app/[workspaceSlug]/_components/target-drawer/TargetDrawer";
import { api } from "~/trpc/react";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

export const TargetPageContent: React.FC<{
  workspace: schema.Workspace;
  view: schema.TargetView | null;
}> = ({ workspace, view }) => {
  const { filter, setFilter, setView } = useTargetFilter();
  const workspaceId = workspace.id;
  const targetsAll = api.target.byWorkspaceId.list.useQuery({
    workspaceId,
    limit: 0,
  });
  const targets = api.target.byWorkspaceId.list.useQuery(
    { workspaceId, filter },
    { placeholderData: (prev) => prev },
  );

  const onFilterChange = (condition: TargetCondition | undefined) => {
    const cond = condition ?? defaultCondition;
    if (isEmptyCondition(cond)) setFilter(undefined);
    if (!isEmptyCondition(cond)) setFilter(cond);
  };

  const { targetId, setTargetId } = useTargetDrawer();

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted workspace={workspace} />;
  return (
    <div className="h-full text-sm">
      <div className="flex h-[41px] items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex items-center gap-2">
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
              onSubmit={setView}
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
          onClear={() => setFilter(undefined)}
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
