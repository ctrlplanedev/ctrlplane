import type { Resource } from "@ctrlplane/db/schema";

import { Card } from "@ctrlplane/ui/card";

import { TargetHierarchyRelationshipsDiagram } from "./RelationshipsDiagram";

export const RelationshipsContent: React.FC<{
  target: Resource;
}> = ({ target }) => {
  return (
    <div className="h-full space-y-2 text-sm">
      <div>Hierarchy</div>
      <Card className="h-[90%]">
        <TargetHierarchyRelationshipsDiagram targetId={target.id} />
      </Card>
    </div>
  );
};
