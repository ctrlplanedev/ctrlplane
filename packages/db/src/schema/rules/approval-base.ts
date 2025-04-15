import { sql } from "drizzle-orm";
import { pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";

import { user } from "../auth.js";

// Approval status enum
export const approvalStatus = pgEnum("approval_status", [
  "approved",
  "rejected",
]);

// Base approval record fields that all record types share
export const baseApprovalRecordFields = {
  id: uuid("id").primaryKey().defaultRandom(),

  // Link to the deployment version being approved
  deploymentVersionId: uuid("deployment_version_id").notNull(),

  // User who performed the approval/rejection action
  userId: uuid("user_id")
    .references(() => user.id)
    .notNull(),

  // Status of this approval
  status: approvalStatus("status").notNull(),

  // Timestamp of when the approval was performed
  approvedAt: timestamp("approved_at", { withTimezone: true }).default(
    sql`NULL`,
  ),

  // Reason provided by approver
  reason: text("reason"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
};

export enum ApprovalStatus {
  Approved = "approved",
  Rejected = "rejected",
}

// Base validation fields for approval records
export const baseApprovalRecordValidationFields = {
  deploymentVersionId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(approvalStatus.enumValues),
  reason: z.string().optional(),
};
