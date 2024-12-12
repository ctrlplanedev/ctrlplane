import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { InferSelectModel } from "drizzle-orm";
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
import { z } from "zod";

import {
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { user } from "./auth.js";
import { deployment } from "./deployment.js";
import { release, releaseChannel } from "./release.js";
import { system } from "./system.js";
import { variableSetEnvironment } from "./variable-sets.js";

export const environment = pgTable(
  "environment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default(""),
    policyId: uuid("policy_id").references(() => environmentPolicy.id, {
      onDelete: "set null",
    }),
    resourceFilter: jsonb("resource_filter")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`NULL`,
    ),
  },
  (t) => ({ uniq: uniqueIndex().on(t.systemId, t.name) }),
);

export type Environment = InferSelectModel<typeof environment>;

export const createEnvironment = createInsertSchema(environment, {
  resourceFilter: resourceCondition
    .optional()
    .refine((filter) => filter == null || isValidResourceCondition(filter)),
})
  .omit({ id: true })
  .extend({
    releaseChannels: z
      .array(
        z.object({
          channelId: z.string().uuid(),
          deploymentId: z.string().uuid(),
        }),
      )
      .optional()
      .refine((channels) => {
        if (channels == null) return true;
        const deploymentIds = new Set(channels.map((c) => c.deploymentId));
        return deploymentIds.size === channels.length;
      }),
  });

export const updateEnvironment = createEnvironment.partial();
export type InsertEnvironment = z.infer<typeof createEnvironment>;

export const environmentRelations = relations(environment, ({ many, one }) => ({
  policy: one(environmentPolicy, {
    fields: [environment.policyId],
    references: [environmentPolicy.id],
  }),
  releaseChannels: many(environmentReleaseChannel),
  environments: many(variableSetEnvironment),
  system: one(system, {
    fields: [environment.systemId],
    references: [system.id],
  }),
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

  // Duration in milliseconds over which to gradually roll out releases to this
  // environment
  rolloutDuration: bigint("rollout_duration", { mode: "number" })
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

export const environmentPolicyRelations = relations(
  environmentPolicy,
  ({ many }) => ({
    environmentPolicyReleaseChannels: many(environmentPolicyReleaseChannel),
    environments: many(environment),
  }),
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

export const environmentPolicyReleaseChannel = pgTable(
  "environment_policy_release_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => environmentPolicy.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => releaseChannel.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.policyId, t.channelId),
    deploymentUniq: uniqueIndex().on(t.policyId, t.deploymentId),
  }),
);

export type EnvironmentPolicyReleaseChannel = InferSelectModel<
  typeof environmentPolicyReleaseChannel
>;

export const environmentPolicyReleaseChannelRelations = relations(
  environmentPolicyReleaseChannel,
  ({ one }) => ({
    environmentPolicy: one(environmentPolicy, {
      fields: [environmentPolicyReleaseChannel.policyId],
      references: [environmentPolicy.id],
    }),
    releaseChannel: one(releaseChannel, {
      fields: [environmentPolicyReleaseChannel.channelId],
      references: [releaseChannel.id],
    }),
  }),
);

export const environmentReleaseChannel = pgTable(
  "environment_release_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => releaseChannel.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.environmentId, t.channelId),
    deploymentUniq: uniqueIndex().on(t.environmentId, t.deploymentId),
  }),
);

export type EnvironmentReleaseChannel = InferSelectModel<
  typeof environmentReleaseChannel
>;

export const environmentReleaseChannelRelations = relations(
  environmentReleaseChannel,
  ({ one }) => ({
    environment: one(environment, {
      fields: [environmentReleaseChannel.environmentId],
      references: [environment.id],
    }),
    releaseChannel: one(releaseChannel, {
      fields: [environmentReleaseChannel.channelId],
      references: [releaseChannel.id],
    }),
  }),
);

export const environmentMetadata = pgTable(
  "environment_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.environmentId) }),
);

export const updateEnvironmentPolicy = createEnvironmentPolicy
  .partial()
  .extend({
    releaseChannels: z
      .record(z.string().uuid(), z.string().uuid().nullable())
      .optional()
      .refine((channels) => {
        if (channels == null) return true;
        const channelsWithNonNullDeploymentIds = Object.entries(
          channels,
        ).filter(([_, channelId]) => channelId != null);
        const deploymentIds = new Set(
          channelsWithNonNullDeploymentIds.map(
            ([deploymentId, _]) => deploymentId,
          ),
        );
        return deploymentIds.size === channelsWithNonNullDeploymentIds.length;
      }),
    releaseWindows: z.array(setPolicyReleaseWindow).optional(),
  });
