import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { user } from "../auth.js";

export const approvalStatus = pgEnum("approval_status", [
  "approved",
  "rejected",
]);

export const deploymentVersionApprovalRecord = pgTable(
  "deployment_version_approval_record",
  {
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
  },
  (t) => ({
    uniqueDeploymentVersionIdUserId: uniqueIndex(
      "unique_deployment_version_id_user_id",
    ).on(t.deploymentVersionId, t.userId),
  }),
);

// Base validation fields for approval records
export const baseApprovalRecordValidationFields = {
  deploymentVersionId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(approvalStatus.enumValues),
  reason: z.string().optional(),
};

export enum ApprovalStatus {
  Approved = "approved",
  Rejected = "rejected",
}
