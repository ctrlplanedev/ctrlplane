import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { resource } from "./resource.js";
import { system } from "./system.js";
import { workspace } from "./workspace.js";

export const environment = pgTable(
  "environment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default(""),
    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    metadata: jsonb("metadata")
      .notNull()
      .default("{}")
      .$type<Record<string, string>>(),

    workspaceId: uuid("workspace_id").references(() => workspace.id),
  },
  (t) => [uniqueIndex().on(t.systemId, t.name)],
);

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
  },
  (t) => ({ pk: primaryKey({ columns: [t.environmentId, t.resourceId] }) }),
);
