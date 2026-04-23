import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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

    jobAgentSelector: text("job_agent_selector").notNull().default("false"),
    jobAgentConfig: jsonb("job_agent_config")
      .default("{}")
      .$type<Record<string, any>>(),

    metadata: jsonb("metadata")
      .default("{}")
      .$type<Record<string, string>>()
      .notNull(),

    workspaceId: uuid("workspace_id").references(() => workspace.id),
  },
  (t) => [index().on(t.workspaceId), unique().on(t.workspaceId, t.name)],
);

export const deploymentRelations = relations(deployment, ({ many }) => ({
  systemDeployments: many(systemDeployment),
}));

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
