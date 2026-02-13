import { relations } from "drizzle-orm";
import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { resource } from "./resource.js";
import { workspace } from "./workspace.js";

export const deployment = pgTable("deployment", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),

  jobAgentId: uuid("job_agent_id"),
  jobAgentConfig: jsonb("job_agent_config")
    .default("{}")
    .$type<Record<string, any>>()
    .notNull(),

  resourceSelector: text("resource_selector").default("false"),

  metadata: jsonb("metadata")
    .default("{}")
    .$type<Record<string, string>>()
    .notNull(),

  workspaceId: uuid("workspace_id").references(() => workspace.id),
});

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
