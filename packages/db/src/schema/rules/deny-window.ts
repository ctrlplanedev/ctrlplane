import type { InferSelectModel } from "drizzle-orm";
import type { Options } from "rrule";
import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

export const policyRuleDenyWindow = pgTable("policy_rule_deny_window", {
  ...basePolicyRuleFields,

  // RRule fields stored as JSONB to match Options interface
  rrule: jsonb("rrule").notNull().default("{}").$type<Options>(),

  dtend: timestamp("dtend", { withTimezone: false }).default(sql`NULL`),
  timeZone: text("time_zone").notNull(),
});

// Define the structure of RRule Options for Zod validation
// Based on the rrule package type definition
export const rruleSchema = z
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
export const typedRruleSchema = rruleSchema as unknown as z.ZodType<Options>;

export const policyRuleDenyWindowInsertSchema = createInsertSchema(
  policyRuleDenyWindow,
  {
    ...basePolicyRuleValidationFields,
    rrule: typedRruleSchema,
    timeZone: z.string(),
  },
).omit({ id: true, createdAt: true });

// Export schemas and types
export const createPolicyRuleDenyWindow = policyRuleDenyWindowInsertSchema;
export type CreatePolicyRuleDenyWindow = z.infer<
  typeof createPolicyRuleDenyWindow
>;

export const updatePolicyRuleDenyWindow =
  policyRuleDenyWindowInsertSchema.partial();
export type UpdatePolicyRuleDenyWindow = z.infer<
  typeof updatePolicyRuleDenyWindow
>;

// Export types
export type PolicyRuleDenyWindow = InferSelectModel<
  typeof policyRuleDenyWindow
>;

// Export RRule schema
export type RRuleOptions = z.infer<typeof rruleSchema>;
