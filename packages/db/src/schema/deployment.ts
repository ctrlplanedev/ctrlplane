import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { jobAgent } from "./job-agent.js";
import { resource } from "./resource.js";
import { systemDeployment } from "./system.js";
import { workspace } from "./workspace.js";

export const deployment = pgTable(
  "deployment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),

    resourceSelector: text("resource_selector").default("false"),

    metadata: jsonb("metadata")
      .default("{}")
      .$type<Record<string, string>>()
      .notNull(),

    workspaceId: uuid("workspace_id").references(() => workspace.id),
  },
  (t) => [index().on(t.workspaceId)],
);

export const deploymentRelations = relations(deployment, ({ many }) => ({
  systemDeployments: many(systemDeployment),
  jobAgents: many(deploymentJobAgent),
}));

export const deploymentJobAgent = pgTable(
  "deployment_job_agent",
  {
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    jobAgentId: uuid("job_agent_id")
      .notNull()
      .references(() => jobAgent.id, { onDelete: "cascade" }),
    config: jsonb("config")
      .default("{}")
      .$type<Record<string, any>>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.deploymentId, t.jobAgentId] })],
);

export const deploymentJobAgentRelations = relations(
  deploymentJobAgent,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [deploymentJobAgent.deploymentId],
      references: [deployment.id],
    }),
    jobAgent: one(jobAgent, {
      fields: [deploymentJobAgent.jobAgentId],
      references: [jobAgent.id],
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

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastEvaluatedAt: timestamp("last_evaluated_at", {
      withTimezone: true,
    }).notNull(),
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
