import { trpc } from "~/api/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useResource } from "./ResourceProvider";

type Relation = {
  entityId: string;
  entityType: string;
  entity: unknown;
  rule?: { id: string; name: string } | null;
  direction: string;
};

function RelationItem({ relation }: { relation: Relation }) {
  return (
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
  );
}

function IncomingRelations({ relations }: { relations: Relation[] }) {
  if (relations.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-muted-foreground">
        Incoming Relations
      </div>
      <div className="space-y-2">
        {relations.map((relation) => (
          <RelationItem
            key={`${relation.entityId}-${relation.rule?.id}`}
            relation={relation}
          />
        ))}
      </div>
    </div>
  );
}

function OutgoingRelations({ relations }: { relations: Relation[] }) {
  if (relations.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-muted-foreground">
        Outgoing Relations
      </div>
      <div className="space-y-2">
        {relations.map((relation) => (
          <RelationItem
            key={`${relation.entityId}-${relation.rule?.id}`}
            relation={relation}
          />
        ))}
      </div>
    </div>
  );
}

export function RelationsSection() {
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
          <IncomingRelations relations={incomingRelations} />
          <OutgoingRelations relations={outgoingRelations} />
        </div>
      </CardContent>
    </Card>
  );
}
