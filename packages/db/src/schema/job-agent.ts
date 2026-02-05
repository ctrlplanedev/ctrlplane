import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { json, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { job } from "./job.js";
import { workspace } from "./workspace.js";

export const jobAgent = pgTable(
  "job_agent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    config: json("config").notNull().default("{}").$type<Record<string, any>>(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.name) }),
);

export const jobAgentRelations = relations(jobAgent, ({ many }) => ({
  jobs: many(job),
}));

export const createJobAgent = createInsertSchema(jobAgent, {
  name: z.string().min(3),
  config: z.record(z.any()),
}).omit({ id: true });

export const updateJobAgent = createJobAgent.partial();

export type JobAgent = InferSelectModel<typeof jobAgent>;
