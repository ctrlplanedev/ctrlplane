import { useState } from "react";

import { safeFormatDistanceToNowStrict } from "~/lib/date";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateWorkItemDialog } from "./_components/work-queue/CreateWorkItemDialog";
import { WorkQueueCharts } from "./_components/work-queue/WorkQueueCharts";

const ITEMS_PER_PAGE = 50;

function StatsCards({
  stats,
  isLoading,
}: {
  stats?: {
    total: number;
    claimed: number;
    pending: number;
    byKind: { kind: string; count: number }[];
  };
  isLoading: boolean;
}) {
  const cards = [
    { label: "Total Scopes", value: stats?.total },
    { label: "Claimed", value: stats?.claimed },
    { label: "Pending", value: stats?.pending },
    { label: "Kinds", value: stats?.byKind.length },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg border bg-card p-4 text-card-foreground"
        >
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl font-semibold">{value ?? 0}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ClaimStatusBadge({
  claimedBy,
  claimedUntil,
}: {
  claimedBy: string | null;
  claimedUntil: Date | null;
}) {
  if (!claimedBy) {
    return <Badge variant="outline">Unclaimed</Badge>;
  }

  const isExpired = claimedUntil && new Date(claimedUntil) < new Date();
  if (isExpired) {
    return <Badge variant="destructive">Expired</Badge>;
  }

  return <Badge variant="secondary">Claimed</Badge>;
}

function WorkScopeTable() {
  const { workspace } = useWorkspace();
  const [offset, setOffset] = useState(0);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [claimedFilter, setClaimedFilter] = useState<
    "all" | "claimed" | "unclaimed"
  >("all");
  const statsQuery = trpc.reconcile.stats.useQuery({
    workspaceId: workspace.id,
  });

  const chartQuery = trpc.reconcile.chartData.useQuery(
    { workspaceId: workspace.id },
    { refetchInterval: 10_000 },
  );

  const scopesQuery = trpc.reconcile.listWorkScopes.useQuery(
    {
      workspaceId: workspace.id,
      limit: ITEMS_PER_PAGE,
      offset,
      kind: kindFilter === "all" ? undefined : kindFilter,
      claimed: claimedFilter,
    },
    { refetchInterval: 10_000 },
  );

  const kinds = statsQuery.data?.byKind ?? [];
  const scopes = scopesQuery.data?.items ?? [];
  const total = scopesQuery.data?.total ?? 0;
  const hasNext = offset + ITEMS_PER_PAGE < total;
  const hasPrev = offset > 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatsCards stats={statsQuery.data} isLoading={statsQuery.isLoading} />

      <WorkQueueCharts
        data={chartQuery.data}
        isLoading={chartQuery.isLoading}
      />

      <div className="flex items-center gap-3">
        <Select
          value={kindFilter}
          onValueChange={(v) => {
            setKindFilter(v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {kinds.map(({ kind }) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={claimedFilter}
          onValueChange={(v) => {
            setClaimedFilter(v as "all" | "claimed" | "unclaimed");
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Claim status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="unclaimed">Unclaimed</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground">
          {total} item{total !== 1 && "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Scope Type</TableHead>
              <TableHead>Scope ID</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Claimed By</TableHead>
              <TableHead>Not Before</TableHead>
              <TableHead>Event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scopesQuery.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!scopesQuery.isLoading && scopes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No work scope items found
                </TableCell>
              </TableRow>
            )}

            {scopes.map((scope) => (
              <TableRow key={scope.id}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="max-w-[180px] truncate"
                    title={scope.kind}
                  >
                    {scope.kind}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {scope.scopeType || "-"}
                </TableCell>
                <TableCell
                  className="max-w-[200px] truncate font-mono text-xs"
                  title={scope.scopeId}
                >
                  {scope.scopeId || "-"}
                </TableCell>
                <TableCell>{scope.priority}</TableCell>
                <TableCell>
                  <ClaimStatusBadge
                    claimedBy={scope.claimedBy}
                    claimedUntil={scope.claimedUntil}
                  />
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-xs">
                  {scope.claimedBy ?? "-"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {safeFormatDistanceToNowStrict(scope.notBefore, {
                    addSuffix: true,
                  }) ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {safeFormatDistanceToNowStrict(scope.eventTs, {
                    addSuffix: true,
                  }) ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {offset + 1}–{Math.min(offset + ITEMS_PER_PAGE, total)} of{" "}
          {total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setOffset((o) => Math.max(0, o - ITEMS_PER_PAGE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => setOffset((o) => o + ITEMS_PER_PAGE)}
          >
            Next
          </Button>
        </div>
      </div>

    </div>
  );
}

export default function WorkQueuePage() {
  const { workspace } = useWorkspace();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Work Queue</h1>
          <p className="text-sm text-muted-foreground">
            View reconcile work scope items to understand the current state of
            the workspace engine.
          </p>
        </div>
        <CreateWorkItemDialog workspaceId={workspace.id} />
      </div>
      <WorkScopeTable />
    </div>
  );
}
