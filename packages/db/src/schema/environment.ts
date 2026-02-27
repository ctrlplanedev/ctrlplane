import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { resource } from "./resource.js";
import { systemEnvironment } from "./system.js";
import { workspace } from "./workspace.js";

export const environment = pgTable("environment", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),
  description: text("description").default(""),
  resourceSelector: text("resource_selector").default("false"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  metadata: jsonb("metadata")
    .notNull()
    .default("{}")
    .$type<Record<string, string>>(),

  workspaceId: uuid("workspace_id").references(() => workspace.id),
});

export const environmentRelations = relations(environment, ({ many }) => ({
  systemEnvironments: many(systemEnvironment),
}));

export type Environment = InferSelectModel<typeof environment>;

export const computedEnvironmentResource = pgTable(
  "computed_environment_resource",
  {
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.environmentId, t.resourceId] })],
);
