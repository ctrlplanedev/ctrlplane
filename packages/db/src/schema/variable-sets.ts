import type { InferInsertModel } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { system } from "./system.js";

export const variableSet = pgTable("variable_set", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id, { onDelete: "cascade" }),
});

export const variableSetValue = pgTable(
  "variable_set_value",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableSetId: uuid("variable_set_id")
      .notNull()
      .references(() => variableSet.id, { onDelete: "cascade" }),

    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.variableSetId, t.key) }),
);

export type VariableSet = InferInsertModel<typeof variableSet>;
export const createVariableSet = createInsertSchema(variableSet)
  .omit({ id: true })
  .and(
    z.object({
      values: z.array(
        z.object({
          key: z.string().trim().min(3),
          value: z.string(),
        }),
      ),
    }),
  );

export const updateVariableSet = createInsertSchema(variableSet)
  .omit({ id: true })
  .partial()
  .and(
    z
      .object({
        values: z.array(z.object({ key: z.string(), value: z.string() })),
      })
      .partial(),
  );

export type VariableSetValue = InferInsertModel<typeof variableSetValue>;
