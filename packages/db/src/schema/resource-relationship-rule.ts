import { relations } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { workspace } from "./workspace.js";

export const resourceRelationshipRule = pgTable(
  "resource_relationship_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    name: text("name"),
    reference: text("reference").notNull(),

    dependencyType: text("dependency_type").notNull(),
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

export const resourceRelationshipSourceRuleMetadataEquals = pgTable(
  "resource_relationship_rule_source_metadata_equals",
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
    uniqueIndex("unique_resource_relationship_rule_source_metadata_equals").on(
      t.resourceRelationshipRuleId,
      t.key,
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

    sourceKey: text("source_key").notNull(),
    targetKey: text("target_key").notNull(),
  },
  (t) => [
    uniqueIndex("unique_resource_relationship_rule_metadata_match").on(
      t.resourceRelationshipRuleId,
      t.sourceKey,
      t.targetKey,
    ),
  ],
);

export const resourceRelationshipRuleRelations = relations(
  resourceRelationshipRule,
  ({ many }) => ({
    metadataKeysMatches: many(resourceRelationshipRuleMetadataMatch),
    sourceMetadataEquals: many(resourceRelationshipSourceRuleMetadataEquals),
    targetMetadataEquals: many(resourceRelationshipTargetRuleMetadataEquals),
  }),
);

export const resourceRelationshipSourceRuleMetadataEqualsRelations = relations(
  resourceRelationshipSourceRuleMetadataEquals,
  ({ one }) => ({
    rule: one(resourceRelationshipRule, {
      fields: [
        resourceRelationshipSourceRuleMetadataEquals.resourceRelationshipRuleId,
      ],
      references: [resourceRelationshipRule.id],
    }),
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
    dependencyType: z.string().min(1),
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
    metadataKeysMatches: z
      .array(
        z.object({
          sourceKey: z.string().refine((val) => val.trim().length > 0, {
            message: "Source metadata match key cannot be empty",
          }),
          targetKey: z.string().refine((val) => val.trim().length > 0, {
            message: "Target metadata match key cannot be empty",
          }),
        }),
      )
      .optional(),
    sourceMetadataEquals: z
      .array(
        z.object({
          key: z.string().refine((val) => val.trim().length > 0, {
            message: "Key cannot be empty",
          }),
          value: z.string().refine((val) => val.trim().length > 0, {
            message: "Value cannot be empty",
          }),
        }),
      )
      .optional(),
    targetMetadataEquals: z
      .array(
        z.object({
          key: z.string().refine((val) => val.trim().length > 0, {
            message: "Key cannot be empty",
          }),
          value: z.string().refine((val) => val.trim().length > 0, {
            message: "Value cannot be empty",
          }),
        }),
      )
      .optional(),
  });

export const updateResourceRelationshipRule =
  createResourceRelationshipRule.partial();

export type ResourceRelationshipRule =
  typeof resourceRelationshipRule.$inferSelect;
export type ResourceRelationshipRuleMetadataMatch =
  typeof resourceRelationshipRuleMetadataMatch.$inferSelect;
export type ResourceRelationshipRuleMetadataEquals =
  typeof resourceRelationshipTargetRuleMetadataEquals.$inferSelect;
export type ResourceRelationshipRuleTargetMetadataEquals =
  typeof resourceRelationshipTargetRuleMetadataEquals.$inferSelect;
export type ResourceRelationshipRuleSourceMetadataEquals =
  typeof resourceRelationshipSourceRuleMetadataEquals.$inferSelect;
