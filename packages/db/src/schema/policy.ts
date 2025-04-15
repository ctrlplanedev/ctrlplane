import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { deploymentCondition } from "@ctrlplane/validators/deployments";
import { environmentCondition } from "@ctrlplane/validators/environments";
import { resourceCondition } from "@ctrlplane/validators/resources";

import type { policyRuleDeploymentVersionSelector } from "./rules/deployment-selector.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { resource } from "./resource.js";
import { createPolicyRuleAnyApproval } from "./rules/approval-any.js";
import { createPolicyRuleRoleApproval } from "./rules/approval-role.js";
import { createPolicyRuleUserApproval } from "./rules/approval-user.js";
import { createPolicyRuleDenyWindow } from "./rules/deny-window.js";
import { createPolicyRuleDeploymentVersionSelector } from "./rules/deployment-selector.js";
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
  resourceSelector: jsonb("resource_selector")
    .default(sql`NULL`)
    .$type<ResourceCondition | null>(),
});

export const computedPolicyTargetDeployment = pgTable(
  "computed_policy_target_deployment",
  {
    policyTargetId: uuid("policy_target_id")
      .notNull()
      .references(() => policyTarget.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.policyTargetId, t.deploymentId] }) }),
);
export type ComputedPolicyTargetDeployment =
  typeof computedPolicyTargetDeployment.$inferSelect;

export const computedPolicyTargetEnvironment = pgTable(
  "computed_policy_target_environment",
  {
    policyTargetId: uuid("policy_target_id")
      .notNull()
      .references(() => policyTarget.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.policyTargetId, t.environmentId] }) }),
);
export type ComputedPolicyTargetEnvironment =
  typeof computedPolicyTargetEnvironment.$inferSelect;

export const computedPolicyTargetResource = pgTable(
  "computed_policy_target_resource",
  {
    policyTargetId: uuid("policy_target_id")
      .notNull()
      .references(() => policyTarget.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.policyTargetId, t.resourceId] }) }),
);
export type ComputedPolicyTargetResource =
  typeof computedPolicyTargetResource.$inferSelect;

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
  resourceSelector: resourceCondition.nullable(),
}).omit({ id: true });

// Export schemas and types
export const createPolicy = z.intersection(
  policyInsertSchema,
  z.object({
    targets: z.array(policyTargetInsertSchema.omit({ policyId: true })),

    denyWindows: z
      .array(createPolicyRuleDenyWindow.omit({ policyId: true }))
      .optional()
      .nullable(),
    deploymentVersionSelector: createPolicyRuleDeploymentVersionSelector
      .omit({ policyId: true })
      .optional()
      .nullable(),

    versionAnyApprovals: createPolicyRuleAnyApproval
      .omit({ policyId: true })
      .optional()
      .nullable(),
    versionUserApprovals: z
      .array(createPolicyRuleUserApproval.omit({ policyId: true }))
      .optional()
      .nullable(),
    versionRoleApprovals: z
      .array(createPolicyRuleRoleApproval.omit({ policyId: true }))
      .optional()
      .nullable(),
  }),
);
export type CreatePolicy = z.infer<typeof createPolicy>;

export const updatePolicy = policyInsertSchema.partial().extend({
  targets: z
    .array(policyTargetInsertSchema.omit({ policyId: true }))
    .optional(),
  denyWindows: z
    .array(createPolicyRuleDenyWindow.omit({ policyId: true }))
    .optional(),
  deploymentVersionSelector: createPolicyRuleDeploymentVersionSelector
    .omit({ policyId: true })
    .optional()
    .nullable(),
  versionAnyApprovals: createPolicyRuleAnyApproval
    .omit({ policyId: true })
    .optional()
    .nullable(),
  versionUserApprovals: z
    .array(createPolicyRuleUserApproval.omit({ policyId: true }))
    .optional(),
  versionRoleApprovals: z
    .array(createPolicyRuleRoleApproval.omit({ policyId: true }))
    .optional(),
});
export type UpdatePolicy = z.infer<typeof updatePolicy>;

export const createPolicyTarget = policyTargetInsertSchema;
export type CreatePolicyTarget = z.infer<typeof createPolicyTarget>;

export const updatePolicyTarget = policyTargetInsertSchema.partial();
export type UpdatePolicyTarget = z.infer<typeof updatePolicyTarget>;

// Export policy types
export type Policy = InferSelectModel<typeof policy>;
export type PolicyTarget = InferSelectModel<typeof policyTarget>;
export type PolicyDeploymentVersionSelector = InferSelectModel<
  typeof policyRuleDeploymentVersionSelector
>;
