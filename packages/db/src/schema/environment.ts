import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, ColumnsWithTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  bigint,
  foreignKey,
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
import { deploymentVersion } from "./deployment-version.js";
import { system } from "./system.js";

export const directoryPath = z
  .string()
  .refine(
    (path) => !path.includes("//"),
    "Directory cannot contain consecutive slashes",
  )
  .refine(
    (path) => !path.includes(".."),
    "Directory cannot contain relative path segments (..)",
  )
  .refine(
    (path) => path.split("/").every((segment) => !segment.startsWith(".")),
    "Directory segments cannot start with .",
  )
  .refine(
    (path) => !path.startsWith("/") && !path.endsWith("/"),
    "Directory cannot start or end with /",
  )
  .or(z.literal(""));

export const environment = pgTable(
  "environment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    directory: text("directory").notNull().default(""),
    description: text("description").default(""),
    policyId: uuid("policy_id").notNull(),
    resourceFilter: jsonb("resource_filter")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.systemId, t.name),
    policyIdFk: foreignKey({
      columns: [t.policyId],
      foreignColumns: [environmentPolicy.id],
    }).onDelete("set null"),
  }),
);

export type Environment = InferSelectModel<typeof environment>;

export const createEnvironment = createInsertSchema(environment, {
  resourceFilter: resourceCondition
    .optional()
    .refine((filter) => filter == null || isValidResourceCondition(filter)),
})
  .omit({ id: true, policyId: true })
  .extend({
    versionChannels: z
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
    metadata: z.record(z.string()).optional(),
    policyId: z.string().uuid().optional(),
  });

export const updateEnvironment = createEnvironment
  .partial()
  .omit({ policyId: true })
  .extend({
    policyId: z.string().uuid().nullable().optional(),
    directory: directoryPath.optional(),
  });
export type InsertEnvironment = z.infer<typeof createEnvironment>;

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

export const environmentPolicy = pgTable(
  "environment_policy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),

    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id").references(
      (): any => environment.id,
      { onDelete: "cascade" },
    ),
    approvalRequirement: approvalRequirement("approval_required")
      .notNull()
      .default("automatic"),

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
  },
  () => ({
    overridePolicyFK: foreignKey(overridePolicyFKConstraint).onDelete(
      "cascade",
    ),
  }),
);

export type EnvironmentPolicy = InferSelectModel<typeof environmentPolicy>;

const overridePolicyFKConstraint: {
  columns: [AnyPgColumn<{ tableName: "environment_policy" }>];
  foreignColumns: ColumnsWithTable<
    "environment_policy",
    "environment",
    [AnyPgColumn<{ tableName: "environment_policy" }>]
  >;
} = {
  columns: [environmentPolicy.environmentId],
  foreignColumns: [environment.id],
};

export const createEnvironmentPolicy = createInsertSchema(environmentPolicy)
  .omit({ id: true })
  .extend({
    versionChannels: z.record(z.string().uuid().nullable()).optional(),
    releaseWindows: z
      .array(
        z.object({
          recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
          startTime: z.date(),
          endTime: z.date(),
        }),
      )
      .optional(),
  });
export type CreateEnvironmentPolicy = z.infer<typeof createEnvironmentPolicy>;
export const updateEnvironmentPolicy = createEnvironmentPolicy.partial();
export type UpdateEnvironmentPolicy = z.infer<typeof updateEnvironmentPolicy>;

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
    deploymentVersionId: uuid("release_id")
      .notNull()
      .references(() => deploymentVersion.id, { onDelete: "cascade" }),
    status: approvalStatusType("status").notNull().default("pending"),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      precision: 0,
    }).default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.policyId, t.deploymentVersionId) }),
);

export type EnvironmentPolicyApproval = InferSelectModel<
  typeof environmentPolicyApproval
>;
