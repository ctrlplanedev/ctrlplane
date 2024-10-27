import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import type { InferSelectModel } from "drizzle-orm";
import type { z } from "zod";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { releaseCondition } from "@ctrlplane/validators/releases";
import { targetCondition } from "@ctrlplane/validators/targets";

import { user } from "./auth.js";
import { release, releaseChannel } from "./release.js";
import { system } from "./system.js";
import { variableSetEnvironment } from "./variable-sets.js";

export const environment = pgTable("environment", {
  id: uuid("id").primaryKey().defaultRandom(),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  policyId: uuid("policy_id").references(() => environmentPolicy.id, {
    onDelete: "set null",
  }),
  targetFilter: jsonb("target_filter")
    .$type<TargetCondition | null>()
    .default(sql`NULL`),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Environment = InferSelectModel<typeof environment>;

export const createEnvironment = createInsertSchema(environment, {
  targetFilter: targetCondition,
}).omit({ id: true });

export const updateEnvironment = createEnvironment.partial();
export type InsertEnvironment = z.infer<typeof createEnvironment>;

export const environmentRelations = relations(environment, ({ many }) => ({
  environments: many(variableSetEnvironment),
}));

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

export const concurrencyType = pgEnum("concurrency_type", ["all", "some"]);

export const environmentPolicy = pgTable("environment_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id),
  approvalRequirement: approvalRequirement("approval_required")
    .notNull()
    .default("manual"),

  successType: environmentPolicyDeploymentSuccessType("success_status")
    .notNull()
    .default("all"),
  successMinimum: integer("minimum_success").notNull().default(0),

  concurrencyType: concurrencyType("concurrency_type").notNull().default("all"),
  concurrencyLimit: integer("concurrency_limit").notNull().default(1),

  duration: bigint("duration", { mode: "number" }).notNull().default(0),

  releaseFilter: jsonb("release_filter")
    .$type<ReleaseCondition | null>()
    .default(sql`NULL`),

  releaseSequencing: releaseSequencingType("release_sequencing")
    .notNull()
    .default("cancel"),
});

export type EnvironmentPolicy = InferSelectModel<typeof environmentPolicy>;

export const createEnvironmentPolicy = createInsertSchema(environmentPolicy, {
  releaseFilter: releaseCondition.nullable(),
}).omit({ id: true });

export const updateEnvironmentPolicy = createEnvironmentPolicy.partial();

export const environmentPolicyDeploymentReleaseChannel = pgTable(
  "environment_policy_deployment_release_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => environmentPolicy.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => releaseChannel.id, { onDelete: "cascade" }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.policyId, t.channelId) }),
);

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

export const setPolicyReleaseWindow = createInsertSchema(
  environmentPolicyReleaseWindow,
).omit({ id: true });

export type EnvironmentPolicyReleaseWindow = InferSelectModel<
  typeof environmentPolicyReleaseWindow
>;

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
  },
  (t) => ({ uniq: uniqueIndex().on(t.policyId, t.releaseId) }),
);

export type EnvironmentPolicyApproval = InferSelectModel<
  typeof environmentPolicyApproval
>;
