import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { InferSelectModel } from "drizzle-orm";
import type { Options } from "rrule";
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

export const policyRuleDenyWindow = pgTable("policy_rule_deny_window", {
  id: uuid("id").primaryKey().defaultRandom(),

  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  description: text("description"),

  // RRule fields stored as JSONB to match Options interface
  rrule: jsonb("rrule").notNull().default("{}").$type<Options>(),

  dtend: timestamp("dtend", { withTimezone: false }).default(sql`NULL`),
  timeZone: text("time_zone").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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

// Define the structure of RRule Options for Zod validation
// Based on the rrule package type definition
const rruleSchema = z
  .object({
    // Required fields
    freq: z
      .number()
      .describe(
        "Frequency (0=YEARLY, 1=MONTHLY, 2=WEEKLY, 3=DAILY, 4=HOURLY, 5=MINUTELY, 6=SECONDLY)",
      ),

    // Optional fields with defaults
    dtstart: z
      .date()
      .or(z.string().transform((str) => new Date(str)))
      .nullable()
      .default(null)
      .describe("The recurrence start date"),
    interval: z
      .number()
      .default(1)
      .describe("The interval between recurrences (default: 1)"),
    wkst: z
      .number()
      .or(z.object({}).passthrough())
      .nullable()
      .default(null)
      .describe("The week start day (default: 0 for Sunday)"),
    count: z
      .number()
      .nullable()
      .default(null)
      .describe("How many occurrences (null for unlimited)"),
    until: z
      .date()
      .or(z.string().transform((str) => new Date(str)))
      .nullable()
      .optional()
      .describe("The end date of the recurrence"),

    // Optional recurring rule parts
    bysetpos: z
      .array(z.number())
      .optional()
      .describe("The positions within a set of occurrences"),
    bymonth: z
      .array(z.number())
      .optional()
      .describe("The months to apply the rule (1-12)"),
    bymonthday: z
      .array(z.number())
      .optional()
      .describe("The days of the month (1-31, -31 to -1)"),
    bynmonthday: z
      .array(z.number())
      .optional()
      .describe("Negative days of the month"),
    byyearday: z
      .array(z.number())
      .optional()
      .describe("The days of the year (1-366, -366 to -1)"),
    byweekno: z
      .array(z.number())
      .optional()
      .describe("The weeks of the year (1-53, -53 to -1)"),
    byweekday: z
      .array(z.number())
      .or(z.array(z.any()))
      .optional()
      .describe("The days of the week (0=MO to 6=SU, or weekday objects)"),
    bynweekday: z.array(z.any()).optional().describe("Negative days of week"),
    byhour: z
      .array(z.number())
      .optional()
      .describe("The hours of the day (0-23)"),
    byminute: z
      .array(z.number())
      .optional()
      .describe("The minutes of the hour (0-59)"),
    bysecond: z
      .array(z.number())
      .optional()
      .describe("The seconds of the minute (0-59)"),
    byeaster: z
      .number()
      .optional()
      .describe("The offset of Easter Sunday in days"),

    // Additional fields for completeness
    tzid: z.string().optional().describe("Timezone identifier"),
  })
  .passthrough();

// Convert schema to Options type
// Using a separate variable to make TypeScript happy
const typedRruleSchema = rruleSchema as unknown as z.ZodType<Options>;

export const policyRuleDenyWindowInsertSchema = createInsertSchema(
  policyRuleDenyWindow,
  {
    policyId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    rrule: typedRruleSchema,
    timeZone: z.string(),
  },
).omit({ id: true, createdAt: true });

// Export schemas and types
export const createPolicy = policyInsertSchema;
export type CreatePolicy = z.infer<typeof createPolicy>;

export const updatePolicy = policyInsertSchema.partial();
export type UpdatePolicy = z.infer<typeof updatePolicy>;

export const createPolicyTarget = policyTargetInsertSchema;
export type CreatePolicyTarget = z.infer<typeof createPolicyTarget>;

export const updatePolicyTarget = policyTargetInsertSchema.partial();
export type UpdatePolicyTarget = z.infer<typeof updatePolicyTarget>;

export const createPolicyRuleDenyWindow =
  policyRuleDenyWindowInsertSchema.extend({
    policyId: z.string().uuid().optional(),
  });
export type CreatePolicyRuleDenyWindow = z.infer<
  typeof createPolicyRuleDenyWindow
>;

export const updatePolicyRuleDenyWindow =
  policyRuleDenyWindowInsertSchema.partial();
export type UpdatePolicyRuleDenyWindow = z.infer<
  typeof updatePolicyRuleDenyWindow
>;

// Export RRule schema
export { typedRruleSchema as rruleSchema };
export type RRuleOptions = z.infer<typeof rruleSchema>;

// Export select types
export type Policy = InferSelectModel<typeof policy>;
export type PolicyTarget = InferSelectModel<typeof policyTarget>;
export type PolicyRuleDenyWindow = InferSelectModel<
  typeof policyRuleDenyWindow
>;
export type PolicyDeploymentVersionSelector = InferSelectModel<
  typeof policyDeploymentVersionSelector
>;
