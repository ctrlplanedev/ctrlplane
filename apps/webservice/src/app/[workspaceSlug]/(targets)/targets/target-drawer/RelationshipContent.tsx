import type { Target } from "@ctrlplane/db/schema";

import { Card } from "@ctrlplane/ui/card";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";

export const RelationshipsContent: React.FC<{
  target: Target;
}> = ({ target }) => {
  const childrenTargets = api.target.byWorkspaceId.list.useQuery({
    workspaceId: target.workspaceId,
    filters: [
      {
        type: "comparison",
        operator: "and",
        conditions: [
          {
            type: "metadata",
            operator: "equals",
            key: ReservedMetadataKey.ParentTargetIdentifier,
            value: target.identifier,
          },
        ],
      },
    ],
  });
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div>Children</div>
        <Card className="px-3 py-2">
          {childrenTargets.data?.items.map((t) => (
            <div key={t.id}>
              {t.name} {t.kind}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};
