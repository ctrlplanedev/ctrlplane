import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  deploymentVersionCondition,
  DeploymentVersionStatus,
} from "@ctrlplane/validators/releases";

import { deployment } from "./deployment.js";

export const versionDependency = pgTable(
  "deployment_version_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("deployment_version_id")
      .notNull()
      .references(() => deploymentVersion.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    versionSelector: jsonb("deployment_version_selector")
      .$type<DeploymentVersionCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ unq: uniqueIndex().on(t.versionId, t.deploymentId) }),
);

export type VersionDependency = InferSelectModel<typeof versionDependency>;
export type VersionDependencyInsert = InferInsertModel<
  typeof versionDependency
>;

const createVersionDependency = createInsertSchema(versionDependency, {
  versionSelector: deploymentVersionCondition,
}).omit({ id: true });

export const versionStatus = pgEnum("deployment_version_status", [
  "building",
  "ready",
  "failed",
  "rejected",
]);

export const deploymentVersion = pgTable(
  "deployment_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tag: text("tag").notNull(),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    jobAgentConfig: jsonb("job_agent_config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    status: versionStatus("status").notNull().default("ready"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex().on(t.deploymentId, t.tag),
    createdAtIdx: index("deployment_version_created_at_idx").on(t.createdAt),
  }),
);

export type DeploymentVersion = InferSelectModel<typeof deploymentVersion>;

export const createDeploymentVersion = createInsertSchema(deploymentVersion, {
  tag: z.string().min(1),
  name: z.string().optional(),
  config: z.record(z.any()),
  jobAgentConfig: z.record(z.any()),
  status: z.nativeEnum(DeploymentVersionStatus),
  createdAt: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
})
  .omit({ id: true })
  .extend({
    dependencies: z
      .array(createVersionDependency.omit({ versionId: true }))
      .default([]),
  });

export const updateDeploymentVersion = createDeploymentVersion.partial();
export type UpdateDeploymentVersion = z.infer<typeof updateDeploymentVersion>;
export const deploymentVersionMetadata = pgTable(
  "deployment_version_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    versionId: uuid("deployment_version_id")
      .references(() => deploymentVersion.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.key, t.versionId),
    versionIdIdx: index("deployment_version_metadata_version_id_idx").on(
      t.versionId,
    ),
    versionIdKeyValueIdx: index(
      "deployment_version_metadata_version_id_key_value_idx",
    ).on(t.versionId, t.key, t.value),
  }),
);

export const deploymentVersionRelations = relations(
  deploymentVersion,
  ({ one, many }) => ({
    deployment: one(deployment, {
      fields: [deploymentVersion.deploymentId],
      references: [deployment.id],
    }),
    metadata: many(deploymentVersionMetadata),
    dependencies: many(versionDependency),
  }),
);

export const versionDependencyRelations = relations(
  versionDependency,
  ({ one }) => ({
    version: one(deploymentVersion, {
      fields: [versionDependency.versionId],
      references: [deploymentVersion.id],
    }),
    deployment: one(deployment, {
      fields: [versionDependency.deploymentId],
      references: [deployment.id],
    }),
  }),
);

export const deploymentVersionMetadataRelations = relations(
  deploymentVersionMetadata,
  ({ one }) => ({
    version: one(deploymentVersion, {
      fields: [deploymentVersionMetadata.versionId],
      references: [deploymentVersion.id],
    }),
  }),
);
