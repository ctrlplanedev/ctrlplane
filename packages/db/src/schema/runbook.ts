import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { runhook } from "./event.js";
import { jobAgent } from "./job-agent.js";
import { job } from "./job.js";
import { runbookVariable } from "./runbook-variables.js";
import { system } from "./system.js";

export const runbook = pgTable("runbook", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id, { onDelete: "cascade" }),
  jobAgentId: uuid("job_agent_id").references(() => jobAgent.id, {
    onDelete: "set null",
  }),
  jobAgentConfig: jsonb("job_agent_config")
    .default("{}")
    .$type<Record<string, any>>()
    .notNull(),
});

const runbookInsert = createInsertSchema(runbook, {
  name: z.string().min(1),
  jobAgentConfig: z.record(z.any()),
}).omit({ id: true });

export const createRunbook = runbookInsert;
export const updateRunbook = runbookInsert.partial();
export type Runbook = InferSelectModel<typeof runbook>;

export const runbookRelations = relations(runbook, ({ many, one }) => ({
  runhooks: many(runhook),
  jobAgent: one(jobAgent, {
    fields: [runbook.jobAgentId],
    references: [jobAgent.id],
  }),
  variables: many(runbookVariable),
}));

export const runbookJobTrigger = pgTable(
  "runbook_job_trigger",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    jobId: uuid("job_id")
      .references(() => job.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    runbookId: uuid("runbook_id")
      .references(() => runbook.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => ({}),
);

export type RunbookJobTrigger = InferSelectModel<typeof runbookJobTrigger>;

export const createRunbookJobTrigger = createInsertSchema(
  runbookJobTrigger,
).omit({
  id: true,
});
export const updateRunbookJobTrigger = createRunbookJobTrigger.partial();
