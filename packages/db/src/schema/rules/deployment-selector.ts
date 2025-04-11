import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { policy } from "../policy.js";

export const policyDeploymentVersionSelector = pgTable(
  "policy_deployment_version_selector",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // can only have one deployment version selector per policy, you can do and
    // ors in the deployment version selector.
    policyId: uuid("policy_id")
      .notNull()
      .unique()
      .references(() => policy.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),

    deploymentVersionSelector: jsonb("deployment_version_selector")
      .notNull()
      .$type<DeploymentVersionCondition>(),
  },
);

export const createPolicyDeploymentVersionSelector = createInsertSchema(
  policyDeploymentVersionSelector,
  { policyId: z.string().uuid() },
).omit({ id: true });
