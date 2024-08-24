import type { InferInsertModel } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { system } from "./system.js";

export const valueSet = pgTable("value_set", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id),
});
export type ValueSet = InferInsertModel<typeof valueSet>;
export const createValueSet = createInsertSchema(valueSet)
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

export const updateValueSet = createInsertSchema(valueSet)
  .omit({ id: true })
  .partial()
  .and(
    z
      .object({
        values: z.array(z.object({ key: z.string(), value: z.string() })),
      })
      .partial(),
  );

export const value = pgTable(
  "value",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    valueSetId: uuid("value_set_id")
      .notNull()
      .references(() => valueSet.id),
    key: text("key"),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.valueSetId, t.key, t.value) }),
);
export type Value = InferInsertModel<typeof value>;
