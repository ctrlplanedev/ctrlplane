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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { resource } from "./resource.js";
import { system } from "./system.js";

export const directoryPath = z
  .string()
  .refine(
    (path) => !path.includes("//"),
    "Directory cannot contain consecutive slashes",
  )
  .refine(
    (path) => !path.includes(".."),
    "Directory cannot contain relative path segments (..)",
  )
  .refine(
    (path) => path.split("/").every((segment) => !segment.startsWith(".")),
    "Directory segments cannot start with .",
  )
  .refine(
    (path) => !path.startsWith("/") && !path.endsWith("/"),
    "Directory cannot start or end with /",
  )
  .or(z.literal(""));

export const environment = pgTable(
  "environment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    directory: text("directory").notNull().default(""),
    description: text("description").default(""),
    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.systemId, t.name),
  }),
);

export type Environment = InferSelectModel<typeof environment>;

export const createEnvironment = createInsertSchema(environment, {
  resourceSelector: resourceCondition
    .optional()
    .refine(
      (selector) => selector == null || isValidResourceCondition(selector),
    ),
})
  .omit({ id: true })
  .extend({ metadata: z.record(z.string()).optional() });

export const updateEnvironment = createEnvironment
  .partial()
  .extend({ directory: directoryPath.optional() });
export type InsertEnvironment = z.infer<typeof createEnvironment>;

export const environmentMetadata = pgTable(
  "environment_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.environmentId) }),
);

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
