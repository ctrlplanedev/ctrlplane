import { pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

/**
 * Enum defining types of resource dependency relationships.
 */
const resourceDependencyType = pgEnum("resource_dependency_type", [
  /**
   * Direct dependency, indicating that the source explicitly depends on the
   * target.
   * @example Backend depends directly on MySQL database being available.
   */
  "depends_on",

  /**
   * Indirect dependency, where the source indirectly relies on the target
   * through intermediate services.
   * @example Frontend indirectly depends on database via a backend API.
   */
  "depends_indirectly_on",

  /**
   * Runtime dependency, indicating the source dynamically interacts with the
   * target at runtime.
   * @example Application dynamically connects to Stripe API at runtime.
   */
  "uses_at_runtime",

  /**
   * Sequential dependency, indicating the source must be provisioned or created
   * after the target.
   * @example Salesforce account creation triggers application provisioning.
   */
  "created_after",

  /**
   * Infrastructure dependency, indicating the source resource is provisioned or
   * hosted within the target infrastructure.
   * @example Kubernetes cluster provisioned inside a Google Cloud project.
   */
  "provisioned_in",

  /**
   * Inheritance dependency, where the source inherits configuration or
   * properties from the target resource.
   * @example App-specific logging configuration inherits from base logging
   * configuration.
   */
  "inherits_from",
]);

export const resourceRelationshipRule = pgTable(
  "resource_relationship_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    reference: text("reference").notNull(),

    dependencyType: resourceDependencyType("dependency_type").notNull(),
    dependencyDescription: text("dependency_description"),

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
