import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { environmentCondition } from "@ctrlplane/validators/environments";

import { workspace } from "./workspace.js";

export const variableSet = pgTable("variable_set", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  environmentSelector: jsonb("environment_selector")
    .default(sql`NULL`)
    .$type<EnvironmentCondition | null>(),
  priority: integer("priority").notNull().default(0),
});

export type VariableSet = InferSelectModel<typeof variableSet>;
export const createVariableSet = createInsertSchema(variableSet)
  .omit({ id: true })
  .extend({
    values: z.array(
      z.object({
        key: z.string().trim().min(3),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    ),
    environmentSelector: environmentCondition.nullable(),
  });

export const updateVariableSet = createVariableSet.partial().extend({
  values: z
    .array(
      z.object({
        key: z.string().trim().min(3),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    )
    .optional(),
});

export const variableSetRelations = relations(variableSet, ({ many, one }) => ({
  values: many(variableSetValue),
  workspace: one(workspace, {
    fields: [variableSet.workspaceId],
    references: [workspace.id],
  }),
}));

export const variableSetValue = pgTable(
  "variable_set_value",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableSetId: uuid("variable_set_id")
      .notNull()
      .references(() => variableSet.id, { onDelete: "cascade" }),

    key: text("key").notNull(),
    value: jsonb("value").$type<any>().notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.variableSetId, t.key) }),
);

export type VariableSetValue = InferSelectModel<typeof variableSetValue>;

export const variableSetValueRelations = relations(
  variableSetValue,
  ({ one }) => ({
    variableSet: one(variableSet, {
      fields: [variableSetValue.variableSetId],
      references: [variableSet.id],
    }),
  }),
);
