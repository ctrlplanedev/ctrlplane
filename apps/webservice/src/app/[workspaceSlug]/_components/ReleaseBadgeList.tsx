import type * as SCHEMA from "@ctrlplane/db/schema";

import { Badge } from "@ctrlplane/ui/badge";

type ReleaseBadgeListProps = {
  releases: {
    items: SCHEMA.Release[];
    total: number;
  };
};

export const ReleaseBadgeList: React.FC<ReleaseBadgeListProps> = ({
  releases,
}) => (
  <div className="flex gap-1">
    {releases.items.map((release) => (
      <Badge key={release.id} variant="outline">
        <span className="max-w-32 truncate text-xs text-muted-foreground">
          {release.name}
        </span>
      </Badge>
    ))}
    {releases.total > releases.items.length && (
      <Badge variant="outline">
        <span className="text-xs text-muted-foreground">
          +{releases.total - releases.items.length}
        </span>
      </Badge>
    )}
  </div>
);
