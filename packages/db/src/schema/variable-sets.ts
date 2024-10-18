import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { environment } from "./environment.js";
import { system } from "./system.js";

export const variableSet = pgTable("variable_set", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemId: uuid("system_id")
    .notNull()
    .references(() => system.id, { onDelete: "cascade" }),
});

export type VariableSet = InferSelectModel<typeof variableSet>;
export const createVariableSet = createInsertSchema(variableSet)
  .omit({ id: true })
  .extend({
    values: z.array(
      z.object({
        key: z.string().trim().min(3),
        value: z.any(),
      }),
    ),
    environmentIds: z.array(z.string().uuid()),
  });

export const updateVariableSet = createVariableSet.partial().extend({
  values: z
    .array(
      z.object({
        key: z.string().trim().min(3),
        value: z.any(),
      }),
    )
    .optional(),
});

export const variableSetRelations = relations(variableSet, ({ many }) => ({
  values: many(variableSetValue),
  assignments: many(variableSetAssignment),
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

export const variableSetAssignment = pgTable("variable_set_assignment", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  variableSetId: uuid("variable_set_id")
    .notNull()
    .references(() => variableSet.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environment.id, { onDelete: "cascade" }),
});

export type VariableSetAssignment = InferSelectModel<
  typeof variableSetAssignment
>;

export const variableSetAssignmentRelations = relations(
  variableSetAssignment,
  ({ one }) => ({
    variableSet: one(variableSet, {
      fields: [variableSetAssignment.variableSetId],
      references: [variableSet.id],
    }),
    environment: one(environment, {
      fields: [variableSetAssignment.environmentId],
      references: [environment.id],
    }),
  }),
);
