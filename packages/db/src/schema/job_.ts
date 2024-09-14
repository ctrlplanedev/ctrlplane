// import {
//   jsonb,
//   pgEnum,
//   pgTable,
//   text,
//   timestamp,
//   uuid,
// } from "drizzle-orm/pg-core";

// import { environment } from "./environment.js";
// import { release } from "./release.js";
// import { target } from "./target.js";

// export const jobAgentConfig = pgTable("job_agent_config", {
//   id: uuid("id").primaryKey().defaultRandom().notNull(),
//   jobId: uuid("job_id"),
//   agentId: uuid("job"),
//   config: jsonb("config").default("{}"),
// });

// export const releaseJobTrigger = pgTable("release_job_trigger", {
//   id: uuid("id").primaryKey().defaultRandom().notNull(),

//   targetId: uuid("target_id")
//     .references(() => target.id)
//     .notNull(),
//   releaseId: uuid("release_id")
//     .references(() => release.id)
//     .notNull(),
//   environmentId: uuid("environment_id")
//     .references(() => environment.id)
//     .notNull(),

//   jobId: uuid("job_id")
//     .references(() => job.id)
//     .unique(),
// });

// export const jobStatus = pgEnum("job_status", [
//   "completed",
//   "cancelled",
//   "skipped",
//   "in_progress",
//   "action_required",
//   "pending",
//   "failure",
//   "invalid_job_agent",
//   "invalid_integration",
//   "external_run_not_found",
// ]);

// export const jobReason = pgEnum("job_reason", [
//   "policy_passing",
//   "policy_override",
//   "env_policy_override",
//   "config_policy_override",
// ]);

// export const job = pgTable("job", {
//   id: uuid("id").primaryKey().defaultRandom().notNull(),

//   jobAgentId: uuid("job_agent_id")
//     .notNull()
//     .references(() => jobAgent.id)
//     .notNull(),

//   jobAgentConfig: jsonb("job_agent_config")
//     .notNull()
//     .default("{}")
//     .$type<Record<string, any>>(),

//   metadata: jsonb("metadata").default("{}").$type<Record<string, any>>(),
//   status: jobStatus("status").notNull().default("pending"),
//   message: text("message"),
//   reason: jobReason("reason").notNull().default("policy_passing"),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at")
//     .defaultNow()
//     .$onUpdate(() => new Date()),
// });
