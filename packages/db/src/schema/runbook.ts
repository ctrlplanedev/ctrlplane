import type { InferSelectModel } from "drizzle-orm";
import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { jobAgent } from "./job-execution.js";
import { system } from "./system.js";

export const runbook = pgTable("runbook", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id, { onDelete: "cascade" }),
  description: text("description"),
  jobAgentId: uuid("job_agent_id").references(() => jobAgent.id, {
    onDelete: "set null",
  }),
  jobAgentConfig: jsonb("job_agent_config")
    .default("{}")
    .$type<Record<string, any>>()
    .notNull(),
});

export type Runbook = InferSelectModel<typeof runbook>;
