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
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  deploymentCondition,
  isValidDeploymentCondition,
} from "@ctrlplane/validators/deployments";
import {
  environmentCondition,
  isValidEnvironmentCondition,
} from "@ctrlplane/validators/environments";
import {
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import type { policyRuleDeploymentVersionSelector } from "./rules/deployment-selector.js";
import { releaseTarget } from "./release.js";
import { createPolicyRuleAnyApproval } from "./rules/approval-any.js";
import { createPolicyRuleRoleApproval } from "./rules/approval-role.js";
import { createPolicyRuleUserApproval } from "./rules/approval-user.js";
import { createPolicyRuleDenyWindow } from "./rules/deny-window.js";
import { createPolicyRuleDeploymentVersionSelector } from "./rules/deployment-selector.js";
import { workspace } from "./workspace.js";

export const policy = pgTable(
  "policy",
  {
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
  },
  (t) => ({ uniquePolicy: unique().on(t.workspaceId, t.name) }),
);

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
  lastComputedAt: timestamp("last_computed_at", {
    withTimezone: true,
  }).default(sql`NULL`),
});

export const computedPolicyTargetReleaseTarget = pgTable(
  "computed_policy_target_release_target",
  {
    policyTargetId: uuid("policy_target_id")
      .notNull()
      .references(() => policyTarget.id, { onDelete: "cascade" }),
    releaseTargetId: uuid("release_target_id")
      .notNull()
      .references(() => releaseTarget.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.policyTargetId, t.releaseTargetId] }),
  }),
);
export type ComputedPolicyTargetReleaseTarget = InferSelectModel<
  typeof computedPolicyTargetReleaseTarget
>;

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
  deploymentSelector: deploymentCondition
    .nullable()
    .refine(
      (selector) => selector == null || isValidDeploymentCondition(selector),
    ),
  environmentSelector: environmentCondition
    .nullable()
    .refine(
      (selector) => selector == null || isValidEnvironmentCondition(selector),
    ),
  resourceSelector: resourceCondition
    .nullable()
    .refine(
      (selector) => selector == null || isValidResourceCondition(selector),
    ),
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

    concurrency: z
      .number()
      .optional()
      .nullable()
      .refine((data) => data == null || data > 0, {
        message: "Concurrency must be greater than 0",
        path: ["concurrency"],
      }),
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

  concurrency: z
    .number()
    .optional()
    .nullable()
    .refine((data) => data == null || data > 0, {
      message: "Concurrency must be greater than 0",
      path: ["concurrency"],
    }),
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
