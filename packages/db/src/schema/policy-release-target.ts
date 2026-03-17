import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { policy } from "./policy.js";
import { resource } from "./resource.js";

export const computedPolicyReleaseTarget = pgTable(
  "computed_policy_release_target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex().on(t.policyId, t.environmentId, t.deploymentId, t.resourceId),
    index().on(t.policyId),
    index().on(t.resourceId, t.environmentId, t.deploymentId),
  ],
);

export const policyReleaseTargetRelations = relations(
  computedPolicyReleaseTarget,
  ({ one }) => ({
    policy: one(policy, {
      fields: [computedPolicyReleaseTarget.policyId],
      references: [policy.id],
    }),
  }),
);
