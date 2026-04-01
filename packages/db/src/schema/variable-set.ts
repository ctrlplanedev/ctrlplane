import type { InferSelectModel } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const variableSet = pgTable("variable_set", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  selector: text("selector").notNull(),

  metadata: jsonb("metadata")
    .notNull()
    .default("{}")
    .$type<Record<string, string>>(),

  priority: integer("priority").notNull().default(0),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type VariableSet = InferSelectModel<typeof variableSet>;

export const variableSetVariable = pgTable(
  "variable_set_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variableSetId: uuid("variable_set_id")
      .notNull()
      .references(() => variableSet.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
  },
  (t) => [unique().on(t.variableSetId, t.key)],
);

export type VariableSetVariable = InferSelectModel<typeof variableSetVariable>;
