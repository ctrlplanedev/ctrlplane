import type * as SCHEMA from "@ctrlplane/db/schema";

import { Badge } from "@ctrlplane/ui/badge";

type DeploymentVersionBadgeListProps = {
  versions: {
    items: SCHEMA.DeploymentVersion[];
    total: number;
  };
};

export const DeploymentVersionBadgeList: React.FC<
  DeploymentVersionBadgeListProps
> = ({ versions }) => (
  <div className="flex gap-1">
    {versions.items.map((version) => (
      <Badge key={version.id} variant="outline">
        <span className="max-w-32 truncate text-xs text-muted-foreground">
          {version.name}
        </span>
      </Badge>
    ))}
    {versions.total > versions.items.length && (
      <Badge variant="outline">
        <span className="text-xs text-muted-foreground">
          +{versions.total - versions.items.length}
        </span>
      </Badge>
    )}
  </div>
);
