"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { IconFilter } from "@tabler/icons-react";
import range from "lodash/range";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { NoFilterMatch } from "../../_components/filter/NoFilterMatch";
import { TargetConditionBadge } from "../../_components/target-condition/TargetConditionBadge";
import { TargetConditionDialog } from "../../_components/target-condition/TargetConditionDialog";
import { useTargetFilter } from "../../_components/target-condition/useTargetFilter";
import { useTargetDrawer } from "../../_components/target-drawer/TargetDrawer";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

export const TargetPageContent: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const { filter, setFilter } = useTargetFilter();

  const targetsAll = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
  });

  const targets = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
    filter,
  });

  const { targetId, setTargetId } = useTargetDrawer();

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted />;
  return (
    <div className="h-full text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <TargetConditionDialog
          condition={filter}
          onChange={(filter) => setFilter(filter)}
        >
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
            >
              <IconFilter className="h-4 w-4" />
            </Button>

            {filter != null && <TargetConditionBadge condition={filter} />}
          </div>
        </TargetConditionDialog>
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
