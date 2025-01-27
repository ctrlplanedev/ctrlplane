import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  bigint,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "./auth.js";
import { release } from "./release.js";
import { system } from "./system.js";

export const approvalRequirement = pgEnum(
  "environment_policy_approval_requirement",
  ["manual", "automatic"],
);

export const environmentPolicyDeploymentSuccessType = pgEnum(
  "environment_policy_deployment_success_type",
  ["all", "some", "optional"],
);

export const releaseSequencingType = pgEnum("release_sequencing_type", [
  "wait",
  "cancel",
]);

export const environmentPolicy = pgTable("environment_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id, { onDelete: "cascade" }),
  approvalRequirement: approvalRequirement("approval_required")
    .notNull()
    .default("manual"),

  successType: environmentPolicyDeploymentSuccessType("success_status")
    .notNull()
    .default("all"),
  successMinimum: integer("minimum_success").notNull().default(0),
  concurrencyLimit: integer("concurrency_limit").default(sql`NULL`),

  // Duration in milliseconds over which to gradually roll out releases to this
  // environment
  rolloutDuration: bigint("rollout_duration", { mode: "number" })
    .notNull()
    .default(0),

  // Minimum interval between releases in milliseconds
  minimumReleaseInterval: bigint("minimum_release_interval", {
    mode: "number",
  })
    .notNull()
    .default(0),

  releaseSequencing: releaseSequencingType("release_sequencing")
    .notNull()
    .default("cancel"),
});

export type EnvironmentPolicy = InferSelectModel<typeof environmentPolicy>;

export const createEnvironmentPolicy = createInsertSchema(
  environmentPolicy,
).omit({ id: true });

export const updateEnvironmentPolicy = createEnvironmentPolicy
  .partial()
  .extend({
    releaseChannels: z.record(z.string().uuid().nullable()).optional(),
    releaseWindows: z
      .array(
        z.object({
          policyId: z.string().uuid(),
          recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
          startTime: z.date(),
          endTime: z.date(),
        }),
      )
      .optional(),
  });

export const recurrenceType = pgEnum("recurrence_type", [
  "hourly",
  "daily",
  "weekly",
  "monthly",
]);

export const environmentPolicyReleaseWindow = pgTable(
  "environment_policy_release_window",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => environmentPolicy.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time", {
      withTimezone: true,
      precision: 0,
    }).notNull(),
    endTime: timestamp("end_time", {
      withTimezone: true,
      precision: 0,
    }).notNull(),
    recurrence: recurrenceType("recurrence").notNull(),
  },
);

export type EnvironmentPolicyReleaseWindow = InferSelectModel<
  typeof environmentPolicyReleaseWindow
>;

export const approvalStatusType = pgEnum("approval_status_type", [
  "pending",
  "approved",
  "rejected",
]);

export const environmentPolicyApproval = pgTable(
  "environment_policy_approval",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => environmentPolicy.id, { onDelete: "cascade" }),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    status: approvalStatusType("status").notNull().default("pending"),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      precision: 0,
    }).default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.policyId, t.releaseId) }),
);

export type EnvironmentPolicyApproval = InferSelectModel<
  typeof environmentPolicyApproval
>;
