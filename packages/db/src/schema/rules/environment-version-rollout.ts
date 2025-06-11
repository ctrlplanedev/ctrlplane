import { decimal, pgEnum, pgTable, uuid } from "drizzle-orm/pg-core";

import { policy } from "../policy.js";
import { basePolicyRuleFields } from "./base.js";

export const rolloutType = pgEnum("rollout_type", ["linear", "exponential"]);
export enum RolloutType {
  Linear = "linear",
  Exponential = "exponential",
}

export const policyRuleEnvironmentVersionRollout = pgTable(
  "policy_rule_environment_version_rollout",
  {
    ...basePolicyRuleFields,

    policyId: uuid("policy_id")
      .notNull()
      .unique()
      .references(() => policy.id, { onDelete: "cascade" }),

    positionGrowthFactor: decimal("position_growth_factor", {
      scale: 2,
    }).notNull(),

    timeScaleInterval: decimal("time_scale_interval", {
      scale: 2,
    }).notNull(),

    rolloutType: rolloutType("rollout_type")
      .notNull()
      .default(RolloutType.Linear),
  },
);

export type PolicyRuleEnvironmentVersionRollout =
  typeof policyRuleEnvironmentVersionRollout.$inferSelect;
