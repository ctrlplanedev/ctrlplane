import { useMemo, useState } from "react";
import { ArrowRight, Edit, Filter, PlusIcon, Search } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";

export function meta() {
  return [
    { title: "Relationship Rules - Ctrlplane" },
    {
      name: "description",
      content: "Define how resources are related to each other",
    },
  ];
}

export default function RelationshipRules() {
  const { workspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [relationshipTypeFilter, setRelationshipTypeFilter] =
    useState<string>("all");

  const { data: relationshipRules } = trpc.relationships.list.useQuery({
    workspaceId: workspace.id,
    limit: 200,
    offset: 0,
  });

  // Get unique relationship types for filter
  const relationshipTypes = useMemo(() => {
    if (!relationshipRules?.items) return [];
    return Array.from(
      new Set(relationshipRules.items.map((rule) => rule.relationshipType)),
    );
  }, [relationshipRules?.items]);

  // Filter rules based on search and filters
  const filteredRules = useMemo(() => {
    if (!relationshipRules?.items) return [];

    return relationshipRules.items.filter((rule) => {
      const matchesSearch =
        searchQuery === "" ||
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        relationshipTypeFilter === "all" ||
        rule.relationshipType === relationshipTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [relationshipRules?.items, searchQuery, relationshipTypeFilter]);

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
                <BreadcrumbPage>Relationship Rules</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="h-9">
            {filteredRules.length} rule{filteredRules.length === 1 ? "" : "s"}
          </Badge>

          <div className="flex min-w-[350px] items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={relationshipTypeFilter}
              onValueChange={setRelationshipTypeFilter}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {relationshipTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Link
            to={`/${workspace.slug}/relationship-rules/create`}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "flex items-center gap-2",
            })}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">
                No relationship rules found
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || relationshipTypeFilter !== "all"
                  ? "Try adjusting your filters to find what you're looking for."
                  : "Get started by creating your first relationship rule."}
              </p>
            </div>
            {!searchQuery && relationshipTypeFilter === "all" && (
              <Link
                to={`/${workspace.slug}/relationship-rules/create`}
                className={buttonVariants({ variant: "default" })}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Relationship Rule
              </Link>
            )}
          </div>
        ) : (
          <Accordion type="multiple" className="w-full space-y-2">
            {filteredRules.map((rule) => (
              <AccordionItem
                key={rule.id}
                value={rule.id}
                className="bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold">
                        {rule.name}
                      </span>
                      <Badge variant="secondary">{rule.relationshipType}</Badge>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{rule.fromType}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{rule.toType}</Badge>
                      </div>
                    </div>
                    <Link
                      to={`/${workspace.slug}/relationship-rules/${rule.reference}/edit`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="space-y-4 pt-4">
                  {rule.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {rule.description}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">From</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Type:
                          </span>
                          <Badge variant="outline">{rule.fromType}</Badge>
                        </div>
                        {rule.fromSelector && "cel" in rule.fromSelector && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                              Selector:
                            </span>
                            <pre className="rounded-md bg-muted p-2 font-mono text-xs">
                              {rule.fromSelector.cel}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">To</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Type:
                          </span>
                          <Badge variant="outline">{rule.toType}</Badge>
                        </div>
                        {rule.toSelector && "cel" in rule.toSelector && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">
                              Selector:
                            </span>
                            <pre className="rounded-md bg-muted p-2 font-mono text-xs">
                              {rule.toSelector.cel}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Matcher</h4>
                      {"cel" in rule.matcher ? (
                        <pre className="rounded-md bg-muted p-3 font-mono text-xs">
                          {rule.matcher.cel}
                        </pre>
                      ) : (
                        <pre className="rounded-md bg-muted p-3 font-mono text-xs">
                          {JSON.stringify(rule.matcher, null, 2)}
                        </pre>
                      )}
                    </div>

                    {Object.keys(rule.metadata).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Metadata</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(rule.metadata).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 rounded-md bg-muted p-2"
                            >
                              <span className="text-xs font-medium">
                                {key}:
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Link
                        to={`/${workspace.slug}/relationship-rules/${rule.reference}/edit`}
                      >
                        <Button variant="default" size="sm">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Rule
                        </Button>
                      </Link>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
            <div />
          </Accordion>
        )}
      </div>
    </>
  );
}
