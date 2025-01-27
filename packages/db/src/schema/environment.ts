import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
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

import { environmentPolicy } from "./environment-policy.js";
import { system } from "./system.js";

export const environment = pgTable(
  "environment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default(""),
    policyId: uuid("policy_id").references(() => environmentPolicy.id, {
      onDelete: "set null",
    }),
    resourceFilter: jsonb("resource_filter")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.systemId, t.name) }),
);

export type Environment = InferSelectModel<typeof environment>;

export const createEnvironment = createInsertSchema(environment, {
  resourceFilter: resourceCondition
    .optional()
    .refine((filter) => filter == null || isValidResourceCondition(filter)),
})
  .omit({ id: true })
  .extend({
    releaseChannels: z
      .array(
        z.object({
          channelId: z.string().uuid(),
          deploymentId: z.string().uuid(),
        }),
      )
      .optional()
      .refine((channels) => {
        if (channels == null) return true;
        const deploymentIds = new Set(channels.map((c) => c.deploymentId));
        return deploymentIds.size === channels.length;
      }),
    metadata: z.record(z.string()).optional(),
  });

export const updateEnvironment = createEnvironment.partial();
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
