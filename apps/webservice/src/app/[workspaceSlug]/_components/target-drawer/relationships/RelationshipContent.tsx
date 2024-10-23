import type { Target } from "@ctrlplane/db/schema";

import { Card } from "@ctrlplane/ui/card";

import { TargetHierarchyRelationshipsDiagram } from "./RelationshipsDiagram";

export const RelationshipsContent: React.FC<{
  target: Target;
}> = ({ target }) => {
  return (
    <div className="h-full space-y-4 bg-green-500">
      <div className="space-y-2 text-sm">
        <div>Hierarchy</div>
        <Card className="h-max">
          <div className="h-max w-full">
            <TargetHierarchyRelationshipsDiagram targetId={target.id} />
          </div>
        </Card>
      </div>
    </div>
  );
};
