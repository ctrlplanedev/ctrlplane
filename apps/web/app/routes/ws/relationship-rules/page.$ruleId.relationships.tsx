import { useMemo, useState } from "react";
import {
  ArrowRight,
  Loader2Icon,
  Search,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";

export function meta() {
  return [
    { title: "Computed Relationships - Ctrlplane" },
    {
      name: "description",
      content: "View computed relationships for a rule",
    },
  ];
}

function entityLabel(
  entity: { name: string; kind?: string; identifier?: string } | null,
  entityType: string,
  entityId: string,
) {
  if (entity == null) return entityId.slice(0, 8);
  if (entity.kind) return `${entity.kind}/${entity.name}`;
  return entity.name;
}

export default function ComputedRelationships() {
  const { workspace } = useWorkspace();
  const { ruleId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: rules } = trpc.relationships.list.useQuery({
    workspaceId: workspace.id,
    limit: 200,
    offset: 0,
  });

  const rule = rules?.find((r) => r.id === ruleId);

  const { data, isLoading } =
    trpc.relationships.computedRelationships.useQuery(
      { ruleId: ruleId!, limit: 500, offset: 0 },
      { enabled: ruleId != null },
    );

  const filtered = useMemo(() => {
    if (!data?.relationships) return [];
    if (searchQuery === "") return data.relationships;

    const q = searchQuery.toLowerCase();
    return data.relationships.filter((rel) => {
      const fromName =
        rel.fromEntity?.name?.toLowerCase() ?? rel.fromEntityId;
      const toName =
        rel.toEntity?.name?.toLowerCase() ?? rel.toEntityId;
      const fromKind = rel.fromEntity?.kind?.toLowerCase() ?? "";
      const toKind = rel.toEntity?.kind?.toLowerCase() ?? "";
      return (
        fromName.includes(q) ||
        toName.includes(q) ||
        fromKind.includes(q) ||
        toKind.includes(q) ||
        rel.fromEntityType.includes(q) ||
        rel.toEntityType.includes(q)
      );
    });
  }, [data, searchQuery]);

  if (!ruleId) return <div>Invalid rule ID</div>;

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
                <Link to={`/${workspace.slug}/relationship-rules`}>
                  Relationship Rules
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {rule?.name ?? "Rule"} — Relationships
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="h-9">
            {filtered.length} relationship{filtered.length === 1 ? "" : "s"}
          </Badge>

          <div className="relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
            <h3 className="text-lg font-semibold">
              No computed relationships
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "No relationships match your search."
                : "This rule hasn't produced any computed relationships yet. Relationships are evaluated automatically when entities change."}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From Type</TableHead>
                  <TableHead>From Entity</TableHead>
                  <TableHead className="w-10" />
                  <TableHead>To Type</TableHead>
                  <TableHead>To Entity</TableHead>
                  <TableHead>Last Evaluated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rel, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {rel.fromEntityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {entityLabel(
                        rel.fromEntity,
                        rel.fromEntityType,
                        rel.fromEntityId,
                      )}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {rel.toEntityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {entityLabel(
                        rel.toEntity,
                        rel.toEntityType,
                        rel.toEntityId,
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rel.lastEvaluatedAt
                        ? new Date(rel.lastEvaluatedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
