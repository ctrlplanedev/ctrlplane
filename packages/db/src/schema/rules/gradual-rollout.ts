import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { policy } from "../policy.js";

export const policyRuleGradualRollout = pgTable("policy_rule_gradual_rollout", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .unique()
    .references(() => policy.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  description: text("description"),

  deployRate: integer("deploy_rate").notNull(),
  windowSizeMinutes: integer("window_size_minutes").notNull(),
});

export const createPolicyRuleGradualRollout = createInsertSchema(
  policyRuleGradualRollout,
  {
    policyId: z.string().uuid(),
    deployRate: z.number().min(1),
    windowSizeMinutes: z.number().min(1),
  },
).omit({ id: true });

export type PolicyGradualRollout = typeof policyRuleGradualRollout.$inferSelect;
