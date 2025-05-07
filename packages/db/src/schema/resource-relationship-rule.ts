import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export enum ResourceDependencyType {
  DependsOn = "depends_on",
  DependsIndirectlyOn = "depends_indirectly_on",
  UsesAtRuntime = "uses_at_runtime",
  CreatedAfter = "created_after",
  ProvisionedIn = "provisioned_in",
  InheritsFrom = "inherits_from",
}

export const resourceRelationshipRule = pgTable(
  "resource_relationship_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    name: text("name"),
    reference: text("reference").notNull(),

    dependencyType: resourceDependencyType("dependency_type").notNull(),
    dependencyDescription: text("dependency_description"),

    description: text("description"),

    sourceKind: text("source_kind").notNull(),
    sourceVersion: text("source_version").notNull(),

    targetKind: text("target_kind"),
    targetVersion: text("target_version"),
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

export const resourceRelationshipTargetRuleMetadataEquals = pgTable(
  "resource_relationship_rule_target_metadata_equals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceRelationshipRuleId: uuid("resource_relationship_rule_id")
      .notNull()
      .references(() => resourceRelationshipRule.id, {
        onDelete: "cascade",
      }),

    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [
    uniqueIndex("unique_resource_relationship_rule_target_metadata_equals").on(
      t.resourceRelationshipRuleId,
      t.key,
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

export const resourceRelationshipRuleRelations = relations(
  resourceRelationshipRule,
  ({ many }) => ({
    metadataMatches: many(resourceRelationshipRuleMetadataMatch),
    metadataEquals: many(resourceRelationshipTargetRuleMetadataEquals),
  }),
);

export const resourceRelationshipRuleMetadataMatchRelations = relations(
  resourceRelationshipRuleMetadataMatch,
  ({ one }) => ({
    rule: one(resourceRelationshipRule, {
      fields: [
        resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
      ],
      references: [resourceRelationshipRule.id],
    }),
  }),
);

export const resourceRelationshipRuleMetadataEqualsRelations = relations(
  resourceRelationshipTargetRuleMetadataEquals,
  ({ one }) => ({
    rule: one(resourceRelationshipRule, {
      fields: [
        resourceRelationshipTargetRuleMetadataEquals.resourceRelationshipRuleId,
      ],
      references: [resourceRelationshipRule.id],
    }),
  }),
);

export const createResourceRelationshipRule = createInsertSchema(
  resourceRelationshipRule,
)
  .omit({ id: true })
  .extend({
    reference: z
      .string()
      .min(1)
      .refine(
        (val) =>
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val) || // slug case
          /^[a-z][a-zA-Z0-9]*$/.test(val) || // camel case
          /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(val), // snake case
        {
          message:
            "Reference must be in slug case (my-reference), camel case (myReference), or snake case (my_reference)",
        },
      ),
    metadataKeysMatch: z.array(z.string().min(1)).optional(),
    metadataKeysEquals: z
      .array(z.object({ key: z.string().min(1), value: z.string().min(1) }))
      .optional(),
  });

export const updateResourceRelationshipRule =
  createResourceRelationshipRule.partial();
