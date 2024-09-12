"use client";

import type { Target, TargetProvider } from "@ctrlplane/db/schema";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { capitalCase } from "change-case";
import { format } from "date-fns";
import _ from "lodash";
import {
  TbCategory,
  TbLock,
  TbLockOpen,
  TbTag,
  TbTarget,
  TbX,
} from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { Input } from "@ctrlplane/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { TableCell, TableHead } from "@ctrlplane/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import type { TargetFilter } from "./TargetFilter";
import { api } from "~/trpc/react";
import { useFilters } from "../../_components/filter/Filter";
import { FilterDropdown } from "../../_components/filter/FilterDropdown";
import {
  ComboboxFilter,
  ContentDialog,
} from "../../_components/filter/FilterDropdownItems";
import { NoFilterMatch } from "../../_components/filter/NoFilterMatch";
import { useMatchSorterWithSearch } from "../../_components/useMatchSorter";
import { LabelFilterDialog } from "./LabelFilterDialog";
import { TargetGettingStarted } from "./TargetGettingStarted";
import { TargetsTable } from "./TargetsTable";

const TargetGeneral: React.FC<Target & { provider: TargetProvider | null }> = (
  target,
) => {
  const labels = Object.entries(target.labels).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );
  const { search, setSearch, result } = useMatchSorterWithSearch(labels, {
    keys: ["0", "1"],
  });
  const link = target.labels["ctrlplane/url"];
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <div className="text-sm">Properties</div>
        <table width="100%" style={{ tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td className="w-[130px] p-1 pr-2 text-muted-foreground">
                Identifier
              </td>
              <td>{target.identifier}</td>
            </tr>
            <tr>
              <td className="w-[130px] p-1 pr-2 text-muted-foreground">Name</td>
              <td>{target.name}</td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Version</td>
              <td>{target.version}</td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Kind</td>
              <td>{target.kind}</td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">
                Target Provider
              </td>
              <td>
                {target.provider != null ? (
                  target.provider.name
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="cursor-help italic text-gray-500">
                          Not set
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[250px]">
                          The next target provider to insert a target with the
                          same identifier will become the owner of this target.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </td>
            </tr>

            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Last Sync</td>
              <td>
                {target.updatedAt &&
                  format(target.updatedAt, "MM/dd/yyyy mm:hh:ss")}
              </td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Link</td>
              <td>
                {link == null ? (
                  <span className="text-muted-foreground">Not set</span>
                ) : (
                  <a
                    href={link}
                    className="inline-block w-full overflow-hidden text-ellipsis text-nowrap hover:text-blue-400"
                  >
                    {link}
                  </a>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-2 text-sm">Labels</div>
        <div className="text-xs">
          <div>
            <Input
              className="w-full rounded-b-none text-xs"
              placeholder="Search ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 overflow-auto rounded-b-lg border-x border-b p-1.5">
            {result.map(([key, value]) => (
              <div className="text-nowrap font-mono" key={key}>
                <span className="text-red-400">{key}:</span>{" "}
                <span className="text-green-300">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DeploymentsContent: React.FC<{ targetId: string }> = ({ targetId }) => {
  const deployments = api.deployment.byTargetId.useQuery(targetId);
  const targetValues =
    api.deployment.variable.value.byTargetId.useQuery(targetId);

  if (!deployments.data || deployments.data.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        This target is not part of any deployments.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deployments.data.map((deployment) => {
        const deploymentVariables = targetValues.data?.filter(
          (v) => v.deploymentId === deployment.id,
        );
        return (
          <div key={deployment.id} className="space-y-2 text-base">
            <div className="flex items-center">
              <div className="flex-grow">
                {deployment.name}{" "}
                <span className="text-xs text-muted-foreground">
                  / {deployment.environment.name}
                </span>
              </div>
              <div
                className={cn(
                  "shrink-0 rounded-full px-2 text-xs",
                  deployment.jobConfig.execution === null &&
                    "bg-neutral-800 text-muted-foreground",
                  deployment.jobConfig.execution?.status === "completed" &&
                    "bg-green-500/30 text-green-400 text-muted-foreground",
                )}
              >
                {deployment.jobConfig.release?.version ?? "No deployments"}
              </div>
            </div>

            <Card>
              {deploymentVariables != null &&
                deploymentVariables.length === 0 && (
                  <div className="p-2 text-sm text-neutral-600">
                    No variables found
                  </div>
                )}
              {deploymentVariables && (
                <table className="w-full">
                  <tbody className="text-left">
                    {deploymentVariables.map(({ key, value }) => (
                      <tr className="text-sm" key={key}>
                        <TableCell className="p-3">{key}</TableCell>
                        <TableCell className="p-3">
                          {value ?? (
                            <div className="italic text-neutral-500">NULL</div>
                          )}
                        </TableCell>
                        <TableHead />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
};

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
    const labelFilter = filters.find((f) => f.key === "labels");
    if (!_.isEqual(labelFilter?.value, combination))
      addFilters([{ key: "labels", value: combination }]);
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
  const lockTarget = api.target.lock.useMutation();
  const unlockTarget = api.target.unlock.useMutation();
  const utils = api.useUtils();

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const targetId = selectedTargetId ?? targets.data?.items.at(0)?.id;

  const targetIdInput = targetId ?? targets.data?.items.at(0)?.id;
  const target = api.target.byId.useQuery(targetIdInput ?? "", {
    enabled: targetIdInput != null,
    refetchInterval: 10_000,
  });

  if (targetsAll.isSuccess && targetsAll.data.total === 0)
    return <TargetGettingStarted />;

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel className="text-sm" defaultSize={60}>
        <div className="h-full">
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
                    {f.key === "labels" && "match"}
                  </span>
                  <span>
                    {typeof f.value === "string" ? (
                      f.value
                    ) : (
                      <HoverCard>
                        <HoverCardTrigger>
                          {Object.entries(f.value).length} label
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
                <LabelFilterDialog>
                  <TbTag /> Label
                </LabelFilterDialog>
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
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={40} className="flex min-w-[450px] flex-col">
        <div className="flex items-center border-b p-6">
          {target.data?.name ? (
            <Link
              href={`/${params.workspaceSlug}/targets/${targetId}`}
              className="block flex-grow font-semibold hover:text-blue-200"
            >
              {target.data.name}
            </Link>
          ) : (
            <Skeleton className="h-6 flex-grow" />
          )}
          {target.data != null && (
            <Button
              variant="outline"
              className="gap-1"
              onClick={() =>
                (target.data?.lockedAt != null ? unlockTarget : lockTarget)
                  .mutateAsync(target.data!.id)
                  .then(() =>
                    utils.target.byWorkspaceId.list.invalidate({
                      workspaceId: workspace.data?.id ?? "",
                      filters,
                    }),
                  )
              }
            >
              {target.data.lockedAt != null ? (
                <>
                  <TbLockOpen /> Unlocked
                </>
              ) : (
                <>
                  <TbLock /> Lock
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex-grow overflow-hidden p-6">
          {target.data && (
            <Tabs defaultValue="general" className="flex h-full flex-col">
              <TabsList className="grid w-full grid-cols-2 border">
                <TabsTrigger value="general" className="m-0">
                  General
                </TabsTrigger>
                <TabsTrigger value="deployments" className="m-0">
                  Deployments
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="general"
                className="flex-grow overflow-auto py-6 pb-12"
              >
                <TargetGeneral {...target.data} />
              </TabsContent>
              <TabsContent
                value="deployments"
                className="flex-grow overflow-auto py-6 pb-12"
              >
                {targetId && <DeploymentsContent targetId={targetId} />}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
