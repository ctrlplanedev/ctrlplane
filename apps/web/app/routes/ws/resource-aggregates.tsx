import { useState } from "react";

import { safeFormatDistanceToNow } from "~/lib/date";
import { BarChart3, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateResourceAggregateDialog } from "./_components/CreateResourceAggregateDialog";

export function meta() {
  return [
    { title: "Resource Aggregates - Ctrlplane" },
    {
      name: "description",
      content: "Manage resource aggregates for tables, charts, and views",
    },
  ];
}

export default function ResourceAggregates() {
  const { workspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [aggregateToDelete, setAggregateToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: aggregates } = trpc.resourceAggregates.list.useQuery({
    workspaceId: workspace.id,
  });

  const deleteMutation = trpc.resourceAggregates.delete.useMutation({
    onSuccess: () => {
      void utils.resourceAggregates.list.invalidate();
      setDeleteDialogOpen(false);
      setAggregateToDelete(null);
    },
  });

  const filtered = (aggregates ?? []).filter((agg) => {
    if (searchQuery === "") return true;
    const q = searchQuery.toLowerCase();
    return (
      agg.name.toLowerCase().includes(q) ||
      agg.description?.toLowerCase().includes(q) ||
      agg.filter.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Resource Aggregates</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CreateResourceAggregateDialog>
            <Button variant="outline" className="h-9">
              <Plus className="h-4 w-4" />
              Create Aggregate
            </Button>
          </CreateResourceAggregateDialog>

          <Badge variant="outline" className="h-9">
            {filtered.length} aggregate{filtered.length === 1 ? "" : "s"}
          </Badge>

          <div className="flex min-w-[350px] items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search aggregates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">No aggregates found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search to find what you're looking for."
                  : "Get started by creating your first resource aggregate."}
              </p>
            </div>
            {!searchQuery && (
              <CreateResourceAggregateDialog>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Aggregate
                </Button>
              </CreateResourceAggregateDialog>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((agg) => (
              <Link
                key={agg.id}
                to={`/${workspace.slug}/resource-aggregates/${agg.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{agg.name}</span>
                    {agg.groupBy != null && agg.groupBy.length > 0 && (
                      <Badge variant="secondary">
                        {agg.groupBy.length} group
                        {agg.groupBy.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  {agg.description && (
                    <p className="text-sm text-muted-foreground">
                      {agg.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {agg.filter !== "true" && (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                        {agg.filter}
                      </code>
                    )}
                    <span>
                      Created{" "}
                      {safeFormatDistanceToNow(agg.createdAt, {
                        addSuffix: true,
                      }) ?? "unknown"}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    setAggregateToDelete({ id: agg.id, name: agg.name });
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Aggregate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {aggregateToDelete?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aggregateToDelete == null) return;
                deleteMutation.mutate({
                  workspaceId: workspace.id,
                  id: aggregateToDelete.id,
                });
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
