import type { InferSelectModel } from "drizzle-orm";
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

import { environment } from "./environment.js";
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
  },
  (t) => ({ uniq: uniqueIndex().on(t.systemId, t.slug) }),
);

export const deploymentLock = pgTable(
  "deployment_lock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deploymentId: uuid("deployment_id").references(() => deployment.id, {
      onDelete: "cascade",
    }),
    environmentId: uuid("environment_id").references(() => environment.id, {
      onDelete: "cascade",
    }),
    lockedAt: timestamp("locked_at").default(new Date()),
  },
  (t) => ({ uniq: uniqueIndex().on(t.deploymentId, t.environmentId) }),
);

const deploymentInsert = createInsertSchema(deployment, {
  ...deploymentSchema.shape,
  jobAgentConfig: z.record(z.any()),
}).omit({ id: true });

export const createDeployment = deploymentInsert;
export const updateDeployment = deploymentInsert.partial();
export type Deployment = InferSelectModel<typeof deployment>;

export const deploymentDependency = pgTable(
  "deployment_meta_dependency",
  {
    id: uuid("id"),
    deploymentId: uuid("deployment_id").references(() => deployment.id),
    dependsOnId: uuid("depends_on_id").references(() => deployment.id),
  },
  (t) => ({ uniq: uniqueIndex().on(t.dependsOnId, t.deploymentId) }),
);
