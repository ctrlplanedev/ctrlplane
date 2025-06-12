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
const ROLLOUT_TYPE_MAPPINGS = {
  linear: {
    api: "linear",
    db: RolloutType.Linear,
  },
  "linear-normalized": {
    api: "linear-normalized",
    db: RolloutType.LinearNormalized,
  },
  exponential: {
    api: "exponential",
    db: RolloutType.Exponential,
  },
  "exponential-normalized": {
    api: "exponential-normalized",
    db: RolloutType.ExponentialNormalized,
  },
} as const;

export const apiRolloutTypeToDBRolloutType: Record<string, RolloutType> =
  Object.fromEntries(
    Object.values(ROLLOUT_TYPE_MAPPINGS).map(({ api, db }) => [api, db]),
  );

export const dbRolloutTypeToAPIRolloutType = Object.fromEntries(
  Object.values(ROLLOUT_TYPE_MAPPINGS).map(({ api, db }) => [db, api]),
) as Record<RolloutType, string>;

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
    rolloutType: z.enum([
      "linear",
      "exponential",
      "linear-normalized",
      "exponential-normalized",
    ]),
  },
).omit({ id: true });
