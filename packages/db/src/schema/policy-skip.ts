import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const policySkip = pgTable("policy_skip", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text("created_by").notNull().default(""),
  environmentId: uuid("environment_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  reason: text("reason").notNull().default(""),
  resourceId: uuid("resource_id"),
  ruleId: uuid("rule_id").notNull(),
  versionId: uuid("version_id").notNull(),
});
