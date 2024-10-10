import type { RunbookVariableConfigType } from "@ctrlplane/validators/variables";
import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { RunbookVariableConfig } from "@ctrlplane/validators/variables";

import { runbook } from "./runbook.js";

export const runbookVariable = pgTable(
  "runbook_variable",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    runbookId: uuid("runbook_id")
      .notNull()
      .references(() => runbook.id, { onDelete: "cascade" }),
    config: jsonb("schema").$type<RunbookVariableConfigType>(),
    required: boolean("required").default(false).notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.runbookId, t.key) }),
);

export type RunbookVariable = InferSelectModel<typeof runbookVariable>;

export const createRunbookVariable = createInsertSchema(runbookVariable, {
  key: z.string().min(1),
  name: z.string().min(1),
  config: RunbookVariableConfig,
}).omit({ id: true, runbookId: true });
export const updateRunbookVariable = createRunbookVariable.partial();
export type InsertRunbookVariable = z.infer<typeof createRunbookVariable>;
