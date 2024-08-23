import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { githubConfigFile } from "./github";
import { jobAgent } from "./job-execution";
import { release } from "./release";
import { system } from "./system";

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
    jobAgentId: uuid("job_agent_id").references(() => jobAgent.id),
    jobAgentConfig: jsonb("job_agent_config")
      .default("{}")
      .$type<Record<string, any>>()
      .notNull(),
    githubConfigFileId: uuid("github_config_file_id").references(
      () => githubConfigFile.id,
      { onDelete: "cascade" },
    ),
  },
  (t) => ({ uniq: uniqueIndex().on(t.systemId, t.slug) }),
);

export const deploymentRelations = relations(deployment, ({ many, one }) => ({
  system: one(system, {
    fields: [deployment.systemId],
    references: [system.id],
  }),
  releases: many(release),
}));

const deploymentInsert = createInsertSchema(deployment, {
  slug: z.string().min(1),
  name: z.string().min(1),
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
