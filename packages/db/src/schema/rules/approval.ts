import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "../auth.js";
import { role } from "../rbac.js";
import { team } from "../team.js";
import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

// Approval types enum
export const approvalType = pgEnum("approval_type", [
  "individual",
  "team",
  "role",
  "any",
]);

// Policy rule for approvals
export const policyRuleApproval = pgTable("policy_rule_approval", {
  ...basePolicyRuleFields,

  // The type of approval required
  approvalType: approvalType("approval_type").notNull(),

  // Required for individual, team, or role approval types
  // For individual: references a user ID
  // For team: references a team ID
  // For role: references a role ID
  approverId: uuid("approver_id").default(sql`NULL`),

  // Minimum number of approvals required for this rule to pass
  requiredApprovalsCount: integer("required_approvals_count")
    .notNull()
    .default(1),
});

// Approval status enum
export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

// Record of approval actions
export const policyRuleApprovalRecord = pgTable("policy_rule_approval_record", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Link to the approval rule
  approvalRuleId: uuid("approval_rule_id")
    .notNull()
    .references(() => policyRuleApproval.id, { onDelete: "cascade" }),

  // Link to the deployment version being approved
  deploymentVersionId: uuid("deployment_version_id").notNull(),

  // User who performed the approval/rejection action
  userId: uuid("user_id")
    .references(() => user.id)
    .notNull(),

  // When approving on behalf of a team, track which team
  teamId: uuid("team_id")
    .references(() => team.id)
    .default(sql`NULL`),

  // When approving based on a role, track which role was used
  roleId: uuid("role_id")
    .references(() => role.id)
    .default(sql`NULL`),

  // Status of this approval
  status: approvalStatus("status").notNull().default("pending"),

  // Reason provided by approver
  reason: text("reason"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Validation schemas
export const policyRuleApprovalInsertSchema = createInsertSchema(
  policyRuleApproval,
  {
    ...basePolicyRuleValidationFields,
    approvalType: z.enum(approvalType.enumValues),
    approverId: z.string().uuid().optional(),
    requiredApprovalsCount: z.number().int().min(1).default(1),
  },
).omit({ id: true, createdAt: true });

export const policyRuleApprovalRecordInsertSchema = createInsertSchema(
  policyRuleApprovalRecord,
  {
    approvalRuleId: z.string().uuid(),
    deploymentVersionId: z.string().uuid(),
    userId: z.string().uuid(),
    teamId: z.string().uuid().optional(),
    roleId: z.string().uuid().optional(),
    status: z.enum(approvalStatus.enumValues).default("pending"),
    reason: z.string().optional(),
  },
).omit({ id: true, createdAt: true, updatedAt: true });

// Export schemas
export const createPolicyRuleApproval = policyRuleApprovalInsertSchema;
export type CreatePolicyRuleApproval = z.infer<typeof createPolicyRuleApproval>;

export const updatePolicyRuleApproval =
  policyRuleApprovalInsertSchema.partial();
export type UpdatePolicyRuleApproval = z.infer<typeof updatePolicyRuleApproval>;

export const createPolicyRuleApprovalRecord =
  policyRuleApprovalRecordInsertSchema;
export type CreatePolicyRuleApprovalRecord = z.infer<
  typeof createPolicyRuleApprovalRecord
>;

export const updatePolicyRuleApprovalRecord =
  policyRuleApprovalRecordInsertSchema.partial();
export type UpdatePolicyRuleApprovalRecord = z.infer<
  typeof updatePolicyRuleApprovalRecord
>;

// Export types
export type PolicyRuleApproval = InferSelectModel<typeof policyRuleApproval>;
export type PolicyRuleApprovalRecord = InferSelectModel<
  typeof policyRuleApprovalRecord
>;
