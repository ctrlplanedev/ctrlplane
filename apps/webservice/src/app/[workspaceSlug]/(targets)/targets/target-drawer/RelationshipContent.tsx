import type { Target } from "@ctrlplane/db/schema";

import { Card } from "@ctrlplane/ui/card";

import { TargetRelationshipsDiagram } from "./RelationshipsDiagram";

export const RelationshipsContent: React.FC<{
  target: Target;
}> = ({ target }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div>Children</div>
        <Card className="px-3 py-2">
          <div className="h-[650px] w-full">
            <TargetRelationshipsDiagram targetId={target.id} />
          </div>
        </Card>
      </div>
    </div>
  );
};
