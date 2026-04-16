import { Pencil } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { EditResourceAggregateDialog } from "../_components/EditResourceAggregateDialog";

export function meta() {
  return [{ title: "Aggregate - Ctrlplane" }];
}

export default function AggregateDetailPage() {
  const { workspace } = useWorkspace();
  const { aggregateId } = useParams<{ aggregateId: string }>();

  const { data: aggregate, isLoading: isLoadingAggregate } =
    trpc.resourceAggregates.get.useQuery(
      { workspaceId: workspace.id, id: aggregateId! },
      { enabled: aggregateId != null },
    );

  const { data: result, isLoading: isLoadingResult } =
    trpc.resourceAggregates.evaluate.useQuery(
      { workspaceId: workspace.id, id: aggregateId! },
      { enabled: aggregateId != null && aggregate?.groupBy != null },
    );

  const isLoading = isLoadingAggregate || isLoadingResult;
  const data = result?.data as
    | {
        groups?: Array<{ key: Record<string, string>; count: number }>;
        total?: number;
      }
    | undefined;
  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;

  const groupByColumns = aggregate?.groupBy ?? [];
  const navigate = useNavigate();

  const buildCelForGroup = (group: { key: Record<string, string> }) => {
    const parts: string[] = [];
    if (aggregate?.filter && aggregate.filter !== "true")
      parts.push(`(${aggregate.filter})`);
    for (const col of groupByColumns) {
      const val = group.key[col.name];
      const escaped = val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      if (val) parts.push(`(${col.property}) == "${escaped}"`);
    }
    return parts.length > 0 ? parts.join(" && ") : "true";
  };

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
                <Link
                  to={`/${workspace.slug}/resource-aggregates`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Resource Aggregates
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{aggregate?.name ?? "..."}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {aggregate?.filter != null && aggregate.filter !== "true" && (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {aggregate.filter}
            </code>
          )}
          <Badge variant="outline" className="h-9">
            {total} resource{total === 1 ? "" : "s"}
          </Badge>
          {aggregate != null && (
            <EditResourceAggregateDialog aggregate={aggregate}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-3 w-3" />
                Edit
              </Button>
            </EditResourceAggregateDialog>
          )}
        </div>
      </header>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
          <h3 className="text-lg font-semibold">No results</h3>
          <p className="text-sm text-muted-foreground">
            No resources matched the filter, or no groupBy is configured.
          </p>
        </div>
      )}

      {!isLoading && groups.length > 0 && (
        <Table className="border-b">
          <TableHeader className="bg-muted/50">
            <TableRow>
              {groupByColumns.map((col) => (
                <TableHead key={col.name} className="font-semibold">
                  {col.name}
                </TableHead>
              ))}
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group, idx) => (
              <TableRow
                key={idx}
                className="cursor-pointer"
                onClick={() => {
                  const cel = buildCelForGroup(group);
                  navigate(
                    `/${workspace.slug}/resources?query=${encodeURIComponent(cel)}`,
                  );
                }}
              >
                {groupByColumns.map((col) => (
                  <TableCell key={col.name}>
                    {group.key[col.name] ? (
                      <span className="font-mono text-red-600 dark:text-red-500">
                        {group.key[col.name]}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground">
                        empty
                      </span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right font-mono font-medium">
                  {group.count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
