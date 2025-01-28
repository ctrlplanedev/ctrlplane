import type { InferSelectModel } from "drizzle-orm";
import { pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { environment, environmentPolicy } from "./environment.js";

export const environmentPolicyDeployment = pgTable(
  "environment_policy_deployment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => environmentPolicy.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.policyId, t.environmentId) }),
);

export type EnvironmentPolicyDeployment = InferSelectModel<
  typeof environmentPolicyDeployment
>;

export const createEnvironmentPolicyDeployment = createInsertSchema(
  environmentPolicyDeployment,
).omit({ id: true });
