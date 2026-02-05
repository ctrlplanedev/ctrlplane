import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { InferSelectModel, SQL } from "drizzle-orm";
import { and, eq, not, or, relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import {
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { ColumnOperatorFn } from "../common.js";
import { jobAgent } from "./job-agent.js";
import { releaseTarget } from "./release.js";
import { resource } from "./resource.js";
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
      .references(() => system.id, { onDelete: "cascade" }),
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
})
  .omit({ id: true })
  .extend({
    exitHooks: z
      .array(
        z.object({
          name: z.string(),
          jobAgentId: z.string().uuid(),
          jobAgentConfig: z.record(z.any()),
        }),
      )
      .optional(),
  });

export const createDeployment = deploymentInsert;
export type CreateDeployment = z.infer<typeof createDeployment>;
export const updateDeployment = deploymentInsert.partial();
export type UpdateDeployment = z.infer<typeof updateDeployment>;
export type Deployment = InferSelectModel<typeof deployment>;

export const deploymentMetadata = pgTable(
  "deployment_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    deploymentId: uuid("deployment_id")
      .references(() => deployment.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.deploymentId) }),
);

export const deploymentMetadataRelations = relations(
  deploymentMetadata,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [deploymentMetadata.deploymentId],
      references: [deployment.id],
    }),
  }),
);

export const computedDeploymentResource = pgTable(
  "computed_deployment_resource",
  {
    deploymentId: uuid("deployment_id")
      .references(() => deployment.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.deploymentId, t.resourceId] }) }),
);

export const computedDeploymentResourceRelations = relations(
  computedDeploymentResource,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [computedDeploymentResource.deploymentId],
      references: [deployment.id],
    }),
    resource: one(resource, {
      fields: [computedDeploymentResource.resourceId],
      references: [resource.id],
    }),
  }),
);

export const deploymentRelations = relations(deployment, ({ one, many }) => ({
  system: one(system, {
    fields: [deployment.systemId],
    references: [system.id],
  }),
  jobAgent: one(jobAgent, {
    fields: [deployment.jobAgentId],
    references: [jobAgent.id],
  }),
  metadata: many(deploymentMetadata),
  computedResources: many(computedDeploymentResource),
  releaseTargets: many(releaseTarget),
}));

const buildCondition = (cond: DeploymentCondition): SQL<unknown> => {
  if (cond.type === "name")
    return ColumnOperatorFn[cond.operator](deployment.name, cond.value);
  if (cond.type === "slug")
    return ColumnOperatorFn[cond.operator](deployment.slug, cond.value);
  if (cond.type === "system") return eq(deployment.systemId, cond.value);
  if (cond.type === "id") return eq(deployment.id, cond.value);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export const deploymentMatchSelector = (
  condition?: DeploymentCondition | null,
): SQL<unknown> | undefined =>
  condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildCondition(condition);
