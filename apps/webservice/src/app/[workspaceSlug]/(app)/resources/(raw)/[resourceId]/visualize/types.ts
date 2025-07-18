import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";

export type ResourceNodeData =
  RouterOutputs["resource"]["visualize"]["resources"][number];

export type System = ResourceNodeData["systems"][number];

export type Edge = {
  sourceId: string;
  targetId: string;
  relationshipType: schema.ResourceRelationshipRule["dependencyType"];
};

export type ResourceInformation = NonNullable<
  RouterOutputs["resource"]["byId"]
>;
