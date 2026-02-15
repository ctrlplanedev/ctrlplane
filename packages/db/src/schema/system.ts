import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { workspace } from "./workspace.js";

export const system = pgTable("system", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  metadata: jsonb("metadata")
    .notNull()
    .default("{}")
    .$type<Record<string, string>>(),
});

export const systemRelations = relations(system, ({ many }) => ({
  systemDeployments: many(systemDeployment),
  systemEnvironments: many(systemEnvironment),
}));

export type System = InferSelectModel<typeof system>;

export const systemDeployment = pgTable(
  "system_deployment",
  {
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.systemId, t.deploymentId] })],
);

export const systemDeploymentRelations = relations(
  systemDeployment,
  ({ one }) => ({
    system: one(system, {
      fields: [systemDeployment.systemId],
      references: [system.id],
    }),
    deployment: one(deployment, {
      fields: [systemDeployment.deploymentId],
      references: [deployment.id],
    }),
  }),
);

export const systemEnvironment = pgTable(
  "system_environment",
  {
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.systemId, t.environmentId] })],
);

export const systemEnvironmentRelations = relations(
  systemEnvironment,
  ({ one }) => ({
    system: one(system, {
      fields: [systemEnvironment.systemId],
      references: [system.id],
    }),
    environment: one(environment, {
      fields: [systemEnvironment.environmentId],
      references: [environment.id],
    }),
  }),
);
