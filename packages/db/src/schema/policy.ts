import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { deploymentCondition } from "@ctrlplane/validators/deployments";
import { environmentCondition } from "@ctrlplane/validators/environments";

import { workspace } from "./workspace.js";

export const policy = pgTable("policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  priority: integer("priority").notNull().default(0),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  enabled: boolean("enabled").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyTarget = pgTable("policy_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),
  deploymentSelector: jsonb("deployment_selector")
    .default(sql`NULL`)
    .$type<DeploymentCondition | null>(),
  environmentSelector: jsonb("environment_selector")
    .default(sql`NULL`)
    .$type<EnvironmentCondition | null>(),
});

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

// Create zod schemas from drizzle schemas
const policyInsertSchema = createInsertSchema(policy, {
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  priority: z.number().default(0),
  workspaceId: z.string().uuid(),
  enabled: z.boolean().default(true),
}).omit({ id: true, createdAt: true });

const policyTargetInsertSchema = createInsertSchema(policyTarget, {
  policyId: z.string().uuid(),
  deploymentSelector: deploymentCondition.nullable(),
  environmentSelector: environmentCondition.nullable(),
}).omit({ id: true });

// Export schemas and types
export const createPolicy = policyInsertSchema;
export type CreatePolicy = z.infer<typeof createPolicy>;

export const updatePolicy = policyInsertSchema.partial();
export type UpdatePolicy = z.infer<typeof updatePolicy>;

export const createPolicyTarget = policyTargetInsertSchema;
export type CreatePolicyTarget = z.infer<typeof createPolicyTarget>;

export const updatePolicyTarget = policyTargetInsertSchema.partial();
export type UpdatePolicyTarget = z.infer<typeof updatePolicyTarget>;

// Export policy types
export type Policy = InferSelectModel<typeof policy>;
export type PolicyTarget = InferSelectModel<typeof policyTarget>;
export type PolicyDeploymentVersionSelector = InferSelectModel<
  typeof policyDeploymentVersionSelector
>;
