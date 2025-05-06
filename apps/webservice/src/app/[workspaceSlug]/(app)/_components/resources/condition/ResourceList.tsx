import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";
import * as LZString from "lz-string";

import { Button } from "@ctrlplane/ui/button";
import { Label } from "@ctrlplane/ui/label";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { ResourceIcon } from "../ResourceIcon";

const useResourceList = (filter: ResourceCondition) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, isLoading: isWorkspaceLoading } =
    api.workspace.bySlug.useQuery(workspaceSlug);

  const { data: resourcesResult, isLoading: isResourcesLoading } =
    api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace?.id ?? "", filter },
      { enabled: workspace != null },
    );

  const { items: resources, total: count } = resourcesResult ?? {
    items: [],
    total: 0,
  };

  const isLoading = isWorkspaceLoading || isResourcesLoading;

  return { resources, count, isLoading };
};

const ResourceItem: React.FC<{
  resource: {
    id: string;
    name: string;
    version: string;
    kind: string;
  };
}> = ({ resource }) => (
  <div className="flex items-center gap-2" key={resource.id}>
    <ResourceIcon version={resource.version} kind={resource.kind} />
    <div className="flex flex-col">
      <span className="overflow-hidden text-nowrap text-sm">
        {resource.name}
      </span>
      <span className="text-xs text-muted-foreground">{resource.version}</span>
    </div>
  </div>
);

type ResourceListProps = {
  filter: ResourceCondition;
  ResourceDiff?: React.FC<{ newResources: SCHEMA.Resource[] }>;
};

export const ResourceList: React.FC<ResourceListProps> = ({
  filter,
  ResourceDiff,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { resources, count, isLoading } = useResourceList(filter);
  const resourcesUrl = urls.workspace(workspaceSlug).resources().baseUrl();

  if (isLoading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-36" />
        ))}
      </div>
    );

  return (
    <div className="space-y-1">
      <Label>Resources ({count})</Label>
      {ResourceDiff != null && <ResourceDiff newResources={resources} />}
      <div className="mb-2 space-y-2">
        {resources.slice(0, 5).map((resource) => (
          <ResourceItem key={resource.id} resource={resource} />
        ))}
      </div>
      <Button variant="outline" size="sm">
        <Link
          href={`${resourcesUrl}?${new URLSearchParams({
            filter: LZString.compressToEncodedURIComponent(
              JSON.stringify(filter),
            ),
          })}`}
          className="flex items-center gap-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconExternalLink className="h-4 w-4" />
          View Resources
        </Link>
      </Button>
    </div>
  );
};
