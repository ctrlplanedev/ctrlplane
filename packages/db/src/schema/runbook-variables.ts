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

import { runbook } from "./runbook.js";

export const runbookVariable = pgTable(
  "runbook_variable",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    key: text("key").notNull(),
    description: text("description").notNull().default(""),
    runbookId: uuid("runbook_id")
      .notNull()
      .references(() => runbook.id),

    required: boolean("required").notNull().default(false),
    schema: jsonb("schema").$type<Record<string, any>>(),
    value: jsonb("value").$type<any>().notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.runbookId, t.key) }),
);

export type RunbookVariable = InferSelectModel<typeof runbookVariable>;
export const createRunbookVariable = createInsertSchema(runbookVariable, {
  schema: z.record(z.any()).optional(),
}).omit({ id: true });
export const updateRunbookVariable = createRunbookVariable.partial();
