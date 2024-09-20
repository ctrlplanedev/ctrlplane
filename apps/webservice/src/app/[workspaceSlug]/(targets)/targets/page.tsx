"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbCategory, TbTag, TbTarget, TbX } from "react-icons/tb";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import type { TargetFilter } from "./TargetFilter";
import { api } from "~/trpc/react";
import { useFilters } from "../../_components/filter/Filter";
import { FilterDropdown } from "../../_components/filter/FilterDropdown";
import {
  ComboboxFilter,
  ContentDialog,
} from "../../_components/filter/FilterDropdownItems";
import { NoFilterMatch } from "../../_components/filter/NoFilterMatch";
import { MetadataFilterDialog } from "./MetadataFilterDialog";
import { TargetDrawer } from "./TargetDrawer";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

export default function TargetsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = api.workspace.bySlug.useQuery(params.workspaceSlug);
  const { filters, removeFilter, addFilters, clearFilters } =
    useFilters<TargetFilter>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const combination: Record<string, string> = useMemo(() => {
    const combinations = searchParams.get("combinations");
    return combinations ? JSON.parse(combinations) : {};
  }, [searchParams]);

  useEffect(() => {
    if (Object.keys(combination).length === 0) return;
    const metadataFilter = filters.find((f) => f.key === "metadata");
    if (!_.isEqual(metadataFilter?.value, combination))
      addFilters([{ key: "metadata", value: combination }]);
    router.replace(`/${params.workspaceSlug}/targets`);
  }, [combination, filters, addFilters, router, params.workspaceSlug]);

  const targetsAll = api.target.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.isSuccess },
  );
  const targets = api.target.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.data?.id ?? "", filters },
    { enabled: workspace.isSuccess },
  );
  const kinds = api.target.byWorkspaceId.kinds.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const targetId = selectedTargetId ?? targets.data?.items.at(0)?.id;

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted />;

  return (
    <div className="h-full text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((f, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="h-7 gap-1.5 bg-neutral-900 pl-2 pr-1 text-xs font-normal"
            >
              <span>{capitalCase(f.key)}</span>
              <span className="text-muted-foreground">
                {f.key === "name" && "contains"}
                {f.key === "kind" && "is"}
                {f.key === "metadata" && "matches"}
              </span>
              <span>
                {typeof f.value === "string" ? (
                  f.value
                ) : (
                  <HoverCard>
                    <HoverCardTrigger>
                      {Object.entries(f.value).length} key
                      {Object.entries(f.value).length > 1 ? "s" : ""}
                    </HoverCardTrigger>
                    <HoverCardContent className="p-2" align="start">
                      {Object.entries(f.value).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-red-400">{key}:</span>{" "}
                          <span className="text-green-400">{value}</span>
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

          <FilterDropdown<TargetFilter>
            filters={filters}
            addFilters={addFilters}
            className="min-w-[200px] bg-neutral-900 p-1"
          >
            <ContentDialog property="name">
              <TbTarget /> Name
            </ContentDialog>
            <ComboboxFilter property="kind" options={kinds.data ?? []}>
              <TbCategory /> Kind
            </ComboboxFilter>
            <MetadataFilterDialog>
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
}
