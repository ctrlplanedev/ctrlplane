import type * as schema from "@ctrlplane/db/schema";

export type Rule = {
  id: string;
  type: string;
  reference: string;
};

export interface ResourceRelationshipManager {
  upsertRelationshipRule(
    relationshipRule: schema.ResourceRelationshipRule,
  ): Promise<schema.ResourceRelationshipRule>;
  deleteRelationshipRule(
    relationshipRule: schema.ResourceRelationshipRule,
  ): Promise<schema.ResourceRelationshipRule>;
  getRelationshipRule(
    id: string,
  ): Promise<schema.ResourceRelationshipRule | null>;
  getAllRelationshipRules(): Promise<schema.ResourceRelationshipRule[]>;

  upsertResource(resource: schema.Resource): Promise<schema.Resource>;
  deleteResource(resource: schema.Resource): Promise<schema.Resource | null>;

  getResourceChildren(
    resource: schema.Resource,
  ): Promise<{ rule: Rule; target: schema.Resource }[]>;

  getResourceParents(
    resource: schema.Resource,
  ): Promise<{ rule: Rule; source: schema.Resource }[]>;
}
