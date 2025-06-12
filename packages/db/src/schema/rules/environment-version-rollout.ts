import { decimal, pgEnum, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { policy } from "../policy.js";
import { basePolicyRuleFields } from "./base.js";

export const rolloutType = pgEnum("rollout_type", [
  "linear",
  "linear_normalized",
  "exponential",
  "exponential_normalized",
]);
export enum RolloutType {
  Linear = "linear",
  LinearNormalized = "linear_normalized",
  Exponential = "exponential",
  ExponentialNormalized = "exponential_normalized",
}

export const policyRuleEnvironmentVersionRollout = pgTable(
  "policy_rule_environment_version_rollout",
  {
    ...basePolicyRuleFields,

    policyId: uuid("policy_id")
      .notNull()
      .unique()
      .references(() => policy.id, { onDelete: "cascade" }),

    positionGrowthFactor: decimal("position_growth_factor")
      .notNull()
      .default("1"),

    timeScaleInterval: decimal("time_scale_interval").notNull(),

    rolloutType: rolloutType("rollout_type")
      .notNull()
      .default(RolloutType.Linear),
  },
);

export type PolicyRuleEnvironmentVersionRollout =
  typeof policyRuleEnvironmentVersionRollout.$inferSelect;

export const createPolicyRuleEnvironmentVersionRollout = createInsertSchema(
  policyRuleEnvironmentVersionRollout,
  {
    policyId: z.string().uuid(),
    positionGrowthFactor: z.number().positive().max(100),
    timeScaleInterval: z.number().positive().max(100),
    rolloutType: z.nativeEnum(RolloutType),
  },
).omit({ id: true });
