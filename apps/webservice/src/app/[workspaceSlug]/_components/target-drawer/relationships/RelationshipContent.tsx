import type { Target } from "@ctrlplane/db/schema";

import { Card } from "@ctrlplane/ui/card";

import { TargetHierarchyRelationshipsDiagram } from "./RelationshipsDiagram";

export const RelationshipsContent: React.FC<{
  target: Target;
}> = ({ target }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div>Hierarchy</div>
        <Card className="px-3 py-2">
          <div className="h-[450px] w-full">
            <TargetHierarchyRelationshipsDiagram targetId={target.id} />
          </div>
        </Card>
      </div>
    </div>
  );
};
