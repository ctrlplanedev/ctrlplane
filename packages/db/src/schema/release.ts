import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deploymentVersion } from "./deployment-version.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { resource } from "./resource.js";

export const release = pgTable("release", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceId: uuid("resource_id")
    .notNull()
    .references(() => resource.id),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environment.id),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployment.id),
  versionId: uuid("version_id")
    .notNull()
    .references(() => deploymentVersion.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const releaseVariable = pgTable(
  "release_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    encrypted: boolean("encrypted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex().on(t.releaseId, t.key)],
);

export const releaseRelations = relations(release, ({ one, many }) => ({
  resource: one(resource, {
    fields: [release.resourceId],
    references: [resource.id],
  }),
  environment: one(environment, {
    fields: [release.environmentId],
    references: [environment.id],
  }),
  deployment: one(deployment, {
    fields: [release.deploymentId],
    references: [deployment.id],
  }),
  version: one(deploymentVersion, {
    fields: [release.versionId],
    references: [deploymentVersion.id],
  }),

  variables: many(releaseVariable),
}));

export const releaseVariableRelations = relations(
  releaseVariable,
  ({ one }) => ({
    release: one(release, {
      fields: [releaseVariable.releaseId],
      references: [release.id],
    }),
  }),
);
