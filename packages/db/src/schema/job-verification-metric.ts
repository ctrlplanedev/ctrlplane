import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { policy } from "./policy.js";

export const jobVerificationStatus = pgEnum("job_verification_status", [
  "failed",
  "inconclusive",
  "passed",
]);

export const jobVerificationTriggerOn = pgEnum("job_verification_trigger_on", [
  "jobCreated",
  "jobStarted",
  "jobSuccess",
  "jobFailure",
]);

export const policyRuleJobVerificationMetric = pgTable(
  "policy_rule_job_verification_metric",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    triggerOn: jobVerificationTriggerOn("trigger_on")
      .notNull()
      .default("jobSuccess"),

    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    provider: jsonb("provider").notNull(),

    intervalSeconds: integer("interval_seconds").notNull(),

    count: integer("count").notNull(),

    successCondition: text("success_condition").notNull(),
    successThreshold: integer("success_threshold").default(0),

    failureCondition: text("failure_condition").default("false"),
    failureThreshold: integer("failure_threshold").default(0),
  },
);

export const jobVerificationMetricStatus = pgTable("job_verification_metric", {
  id: uuid("id").primaryKey().defaultRandom(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  jobId: uuid("job_id")
    .notNull(),

  name: text("name").notNull(),
  provider: jsonb("provider").notNull(),

  intervalSeconds: integer("interval_seconds").notNull(),
  count: integer("count").notNull(),

  successCondition: text("success_condition").notNull(),
  successThreshold: integer("success_threshold").default(0),

  failureCondition: text("failure_condition").default("false"),
  failureThreshold: integer("failure_threshold").default(0),
});

export const jobVerificationMetricMeasurement = pgTable(
  "job_verification_metric_measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobVerificationMetricStatusId: uuid(
      "job_verification_metric_status_id",
    ).references(() => jobVerificationMetricStatus.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull().default("{}"),
    measuredAt: timestamp("measured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    message: text("message").notNull().default(""),
    status: jobVerificationStatus("status").notNull(),
  },
);
