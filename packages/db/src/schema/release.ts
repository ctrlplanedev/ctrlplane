import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { deployment } from "./deployment.js";
import { targetLabelGroup } from "./target-group.js";

export const releaseDependencyRuleType = pgEnum(
  "release_dependency_rule_type",
  ["regex", "semver"],
);

export const releaseDependency = pgTable(
  "release_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    targetLabelGroupId: uuid("target_label_group_id").references(
      () => targetLabelGroup.id,
      { onDelete: "cascade" },
    ),
    ruleType: releaseDependencyRuleType("rule_type").notNull(),
    rule: text("rule").notNull(),
  },
  (t) => ({
    unq: uniqueIndex().on(t.releaseId, t.deploymentId, t.targetLabelGroupId),
  }),
);

const createReleaseDependency = createInsertSchema(releaseDependency).omit({
  id: true,
});

export const release = pgTable(
  "release",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    notes: text("notes").default(""),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ unq: uniqueIndex().on(t.deploymentId, t.version) }),
);

export type Release = InferSelectModel<typeof release>;

export const createRelease = createInsertSchema(release)
  .omit({ id: true })
  .extend({
    releaseDependencies: z
      .array(createReleaseDependency.omit({ releaseId: true }))
      .default([]),
  });

export const releaseRelations = relations(release, ({ one }) => ({
  deployment: one(deployment, {
    fields: [release.deploymentId],
    references: [deployment.id],
  }),
}));
