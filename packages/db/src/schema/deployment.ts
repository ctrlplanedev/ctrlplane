import type { ResourceCondition } from "@ctrlplane/validators/resources";
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

import {
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { jobAgent } from "./job-agent.js";
import { system } from "./system.js";

export const deploymentSchema = z.object({
  systemId: z.string().uuid(),
  id: z.string().uuid({ message: "Invalid ID format." }),
  name: z
    .string()
    .min(3, { message: "Deployment name must be at least 3 characters long." })
    .max(255, {
      message: "Deployment name must be at most 255 characters long.",
    }),
  slug: z
    .string()
    .min(3, { message: "Slug must be at least 3 characters long." })
    .max(255, { message: "Slug must be at most 255 characters long." }),
  description: z
    .string()
    .max(255, { message: "Description must be at most 255 characters long." })
    .refine((val) => !val || val.length >= 3, {
      message: "Description must be at least 3 characters long if provided.",
    }),
  retryCount: z
    .number()
    .default(0)
    .refine((val) => val >= 0, {
      message: "Retry count must be a non-negative number.",
    }),
  timeout: z
    .number()
    .nullable()
    .default(null)
    .refine((val) => val == null || val >= 0, {
      message: "Timeout must be a non-negative number.",
    }),
  resourceSelector: resourceCondition
    .nullable()
    .optional()
    .refine(
      (selector) => selector == null || isValidResourceCondition(selector),
    ),
});

export const deployment = pgTable(
  "deployment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id),
    jobAgentId: uuid("job_agent_id").references(() => jobAgent.id, {
      onDelete: "set null",
    }),
    jobAgentConfig: jsonb("job_agent_config")
      .default("{}")
      .$type<Record<string, any>>()
      .notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    timeout: integer("timeout").default(sql`NULL`),
    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.systemId, t.slug) }),
);

const deploymentInsert = createInsertSchema(deployment, {
  ...deploymentSchema.shape,
  jobAgentConfig: z.record(z.any()),
  description: z.string().optional(),
}).omit({ id: true });

export const createDeployment = deploymentInsert;
export type CreateDeployment = z.infer<typeof createDeployment>;
export const updateDeployment = deploymentInsert.partial();
export type UpdateDeployment = z.infer<typeof updateDeployment>;
export type Deployment = InferSelectModel<typeof deployment>;

export const deploymentRelations = relations(deployment, ({ one }) => ({
  system: one(system, {
    fields: [deployment.systemId],
    references: [system.id],
  }),
}));

export const deploymentDependency = pgTable(
  "deployment_meta_dependency",
  {
    id: uuid("id"),
    deploymentId: uuid("deployment_id").references(() => deployment.id),
    dependsOnId: uuid("depends_on_id").references(() => deployment.id),
  },
  (t) => ({ uniq: uniqueIndex().on(t.dependsOnId, t.deploymentId) }),
);
