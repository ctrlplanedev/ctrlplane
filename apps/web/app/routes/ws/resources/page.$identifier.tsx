import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Link } from "react-router";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { ResourceIcon } from "../../../components/ui/resource-icon";
import { useResource } from "./_components/ResourceProvider";

export function meta() {
  return [
    { title: "Resource Details - Ctrlplane" },
    { name: "description", content: "View resource details" },
  ];
}

const MetadataSection: React.FC<{
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  data: Record<string, string | unknown>;
  isOpen?: boolean;
}> = ({ title, data, isOpen = true }) => {
  const [open, setOpen] = useState(isOpen);

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-0.5 overflow-y-auto pt-0">
            {entries
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start gap-2 font-mono text-xs font-semibold"
                >
                  <span className="shrink-0 text-red-600">{key}:</span>
                  <pre className="text-green-700">
                    {typeof value === "string"
                      ? value
                      : JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const RelationsSection: React.FC = () => {
  const { workspace } = useWorkspace();
  const { resource } = useResource();

  const relationsQuery = trpc.resource.relations.useQuery({
    workspaceId: workspace.id,
    resourceId: resource.id,
  });

  const relationships = relationsQuery.data?.relations ?? {};
  const allRelations = Object.entries(relationships).flatMap(([_, relations]) =>
    relations.map((r) => ({ ...r })),
  );

  if (allRelations.length === 0) {
    return null;
  }

  const incomingRelations = allRelations.filter((r) => r.direction === "from");
  const outgoingRelations = allRelations.filter((r) => r.direction === "to");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Relationships</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {incomingRelations.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                Incoming Relations
              </div>
              <div className="space-y-2">
                {incomingRelations.map((relation) => (
                  <div
                    key={`${relation.entityId}-${relation.rule?.id}`}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {relation.entityType === "resource" && (
                          <ResourceIcon
                            kind={(relation.entity as any).kind}
                            version={(relation.entity as any).version}
                            className="h-4 w-4"
                          />
                        )}
                        <span className="font-medium">
                          {(relation.entity as any).name ?? relation.entityId}
                        </span>
                      </div>
                      {relation.rule && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          via {relation.rule.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outgoingRelations.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                Outgoing Relations
              </div>
              <div className="space-y-2">
                {outgoingRelations.map((relation) => (
                  <div
                    key={`${relation.entityId}-${relation.rule?.id}`}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {relation.entityType === "resource" && (
                          <ResourceIcon
                            kind={(relation.entity as any).kind}
                            version={(relation.entity as any).version}
                            className="h-4 w-4"
                          />
                        )}
                        <span className="font-medium">
                          {(relation.entity as any).name ?? relation.entityId}
                        </span>
                      </div>
                      {relation.rule && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          via {relation.rule.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function ResourceDetail() {
  const { workspace } = useWorkspace();
  const { resource } = useResource();

  const links =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    resource.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : {};

  // Filter out reserved metadata keys for display
  const displayMetadata = Object.fromEntries(
    Object.entries(resource.metadata).filter(
      ([key]) => !Object.values(ReservedMetadataKey).includes(key as any),
    ),
  );

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
                <Link to={`/${workspace.slug}/resources`}>Resources</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>{resource.name}</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header Section */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <ResourceIcon
                kind={resource.kind}
                version={resource.version}
                className="h-12 w-12"
              />
              <div className="flex-1 space-y-1">
                <h1 className="text-3xl font-bold">{resource.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{resource.identifier}</span>
                  <span>•</span>
                  <span>
                    {resource.kind} v{resource.version}
                  </span>
                </div>
              </div>
            </div>

            {/* Links Section */}
            {Object.keys(links).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(links).map(([name, url]) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {name}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm text-muted-foreground">ID</div>
                  <div className="col-span-2 font-mono text-sm">
                    {resource.id}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm text-muted-foreground">
                    Identifier
                  </div>
                  <div className="col-span-2 font-mono text-sm">
                    {resource.identifier}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm text-muted-foreground">Kind</div>
                  <div className="col-span-2 font-mono text-sm">
                    {resource.kind}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm text-muted-foreground">Version</div>
                  <div className="col-span-2 font-mono text-sm">
                    {resource.version}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="col-span-2 text-sm">
                    {new Date(resource.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm text-muted-foreground">
                    Last Updated
                  </div>
                  <div className="col-span-2 text-sm">
                    {resource.updatedAt != null
                      ? new Date(resource.updatedAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relations */}
          <RelationsSection />

          {/* Metadata */}
          {Object.keys(displayMetadata).length > 0 && (
            <MetadataSection title="Metadata" data={displayMetadata} />
          )}

          {/* Config */}
          {Object.keys(resource.config).length > 0 && (
            <MetadataSection
              title="Configuration"
              data={resource.config}
              isOpen={false}
            />
          )}
        </div>
      </div>
    </>
  );
}
