import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const resourceRelationshipRule = pgTable(
  "resource_relationship_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    reference: text("reference").notNull(),
    relationshipType: text("relationship_type").notNull(),
    description: text("description"),

    sourceKind: text("source_kind").notNull(),
    sourceVersion: text("source_version").notNull(),
    targetKind: text("target_kind").notNull(),
    targetVersion: text("target_version").notNull(),
  },
  (t) => [
    uniqueIndex("unique_resource_relationship_rule_reference").on(
      t.workspaceId,
      t.reference,
      t.sourceKind,
      t.sourceVersion,
    ),
  ],
);

export const resourceRelationshipRuleMetadataMatch = pgTable(
  "resource_relationship_rule_metadata_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceRelationshipRuleId: uuid("resource_relationship_rule_id")
      .notNull()
      .references(() => resourceRelationshipRule.id, {
        onDelete: "cascade",
      }),

    key: text("key").notNull(),
  },
  (t) => [
    uniqueIndex("unique_resource_relationship_rule_metadata_match").on(
      t.resourceRelationshipRuleId,
      t.key,
    ),
  ],
);

// export const getAllWorkspaceRelationships = (tx: Tx, workspaceId: string) => {
// const sourceResources = tx.select().from(resource).as("sourceResources");
// const targetResources = tx
//   .select({
//     id: resource.id,
//     workspaceId: resource.workspaceId,
//     kind: resource.kind,
//     version: resource.version,
//     key: resourceMetadata.key,
//     value: resourceMetadata.value,
//   })
//   .from(resource)
//   .innerJoin(resourceMetadata, eq(resource.id, resourceMetadata.resourceId))
//   .as("targetResources");
// const relationships = tx
//   .select({
//     ruleId: resourceRelationshipRule.id,
//     workspaceId: resourceRelationshipRule.workspaceId,
//     reference: resourceRelationshipRule.reference,
//     relationshipType: resourceRelationshipRule.relationshipType,
//     sourceResourceId: sourceResources.id,
//     targetResourceId: targetResources.id,
//   })
//   .from(resourceRelationshipRule)
//   .innerJoin(
//     resourceRelationshipRuleMetadataMatch,
//     eq(
//       resourceRelationshipRule.id,
//       resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
//     ),
//   )
//   .innerJoin(
//     sourceResources,
//     and(
//       eq(resourceRelationshipRule.sourceKind, sourceResources.kind),
//       eq(resourceRelationshipRule.sourceVersion, sourceResources.version),
//       eq(resourceRelationshipRule.workspaceId, sourceResources.workspaceId),
//     ),
//   )
//   .innerJoin(
//     targetResources,
//     and(
//       eq(resourceRelationshipRule.targetKind, targetResources.kind),
//       eq(resourceRelationshipRule.targetVersion, targetResources.version),
//       eq(resourceRelationshipRule.workspaceId, targetResources.workspaceId),
//     ),
//   )
//   .where(and(eq(resourceRelationshipRule.workspaceId, workspaceId)))
//   .groupBy(
//     resourceRelationshipRule.id,
//     resourceRelationshipRule.workspaceId,
//     resourceRelationshipRule.name,
//     resourceRelationshipRule.reference,
//     resourceRelationshipRule.relationshipType,
//     sourceResources.id,
//     targetResources.id,
//   );
// // .having(eq(count(sourceResources.key)));
// return relationships;
// };
