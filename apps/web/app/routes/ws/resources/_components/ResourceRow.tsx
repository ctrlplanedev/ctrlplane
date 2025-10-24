import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";
import { ResourceIcon } from "./ResourceIcon";

type ResourceRowProps = {
  resource: {
    id: string;
    identifier: string;
    name: string;
    kind: string;
    version: string;
    metadata: Record<string, string>;
  };
};

export const ResourceRow: React.FC<ResourceRowProps> = ({ resource }) => {
  const [showChildren, setShowChildren] = useState(false);

  const links =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    resource.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : {};

  return (
    <div className="border-b p-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-6.5"
          onClick={() => setShowChildren(!showChildren)}
        >
          <ChevronRight
            className={cn(
              "size-3 transition-all",
              showChildren ? "rotate-90" : "",
            )}
          />
        </Button>
        <ResourceIcon
          kind={resource.kind}
          version={resource.version}
          className="size-4"
        />
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{resource.name}</div>
        </div>

        <div className="flex items-center gap-1">
          {Object.entries(links).map(([name, url]) => (
            <a
              key={name}
              referrerPolicy="no-referrer"
              href={url}
              className="inline-block w-full overflow-hidden text-ellipsis text-nowrap text-blue-300 hover:text-blue-400"
            >
              {name}
            </a>
          ))}
        </div>
      </div>
      {showChildren && <ChildrenResources resourceId={resource.id} />}
    </div>
  );
};

export const ChildrenResources: React.FC<{ resourceId: string }> = ({
  resourceId,
}) => {
  const { workspace } = useWorkspace();
  const relationsQuery = trpc.resource.relations.useQuery({
    workspaceId: workspace.id,
    resourceId,
  });

  const relationships = relationsQuery.data?.relationships ?? {};
  const resourceRelations = Object.values(relationships).flatMap((r) =>
    r
      .filter((r) => r.entityType === "resource")
      .filter((r) => r.direction === "to")
      .map((r) => r.entity),
  );

  return (
    <div className="ml-3 space-y-2 border-l py-2 pl-4">
      {resourceRelations.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No children resources
        </div>
      )}

      {resourceRelations.map((resource) => (
        <ChildResourceRow
          key={resource.id}
          resource={resource as ResourceRowProps["resource"]}
        />
      ))}
    </div>
  );
};

const ChildResourceRow: React.FC<{
  resource: {
    id: string;
    name: string;
    kind: string;
    version: string;
    metadata: Record<string, string>;
  };
}> = ({ resource }) => {
  const [showChildren, setShowChildren] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-1 text-sm">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setShowChildren(!showChildren)}
        >
          <ChevronRight
            className={cn(
              "size-3 transition-all",
              showChildren ? "rotate-90" : "",
            )}
          />
        </Button>
        <ResourceIcon
          kind={resource.kind}
          version={resource.version}
          className="size-3"
        />
        <div className="text-sm">{resource.name}</div>
      </div>

      {showChildren && <ChildrenResources resourceId={resource.id} />}
    </div>
  );
};
