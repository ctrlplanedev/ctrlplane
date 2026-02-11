import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { relations, sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { jobAgent } from "./job-agent.js";
import { resource } from "./resource.js";
import { system } from "./system.js";
import { workspace } from "./workspace.js";

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
    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),

    workspaceId: uuid("workspace_id").references(() => workspace.id),
  },
  (t) => [uniqueIndex().on(t.systemId, t.slug)],
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
  (t) => [primaryKey({ columns: [t.deploymentId, t.resourceId] })],
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
