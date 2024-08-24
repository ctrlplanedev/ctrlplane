import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { jobAgent } from "./job-execution.js";

export const runbook = pgTable("runbook", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  description: text("description"),
  jobAgentId: uuid("job_agent_id").references(() => jobAgent.id),
  jobAgentConfig: text("job_agent_config"),
});

export type Runbook = InferSelectModel<typeof runbook>;
